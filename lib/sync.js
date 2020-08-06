const fs = require('fs');
const path = require('path');
const escapeRegex = require('escape-string-regexp');

const {
  debug,

  getModuleId,

  getDictionaryRegex,
  getLanguage,

  getCleanSeed,
  getCleanGenerated,

  getSortedObject,
  getDeepSortedObject,
} = require('./utils');


const getFiles = (dirPath, regex) => (
  fs.readdirSync(dirPath).reduce((acc, fileName) => {
    const filePath = path.resolve(`${dirPath}/${fileName}`);

    if (fs.statSync(filePath).isDirectory()) return acc.concat(getFiles(filePath, regex));
    if (regex.test(fileName)) acc.push(filePath);
    return acc;
  }, [])
);

const build = ({ keysRoot, moduleEnding, dictionaryPattern }) => {
  const startTime = Date.now();
  debug('attempting to build');

  const moduleRegex = new RegExp(`${escapeRegex(moduleEnding)}$`);

  const generated = getFiles(keysRoot, moduleRegex).reduce((acc, filePath) => {
    const id = getModuleId(keysRoot, moduleEnding, filePath);
    const data = JSON.parse(fs.readFileSync(filePath));

    Object.keys(data).forEach((language) => {
      if (!acc[language]) acc[language] = {};
      acc[language][id] = getDeepSortedObject(data[language]);
    });

    return acc;
  }, {});

  debug('found %d modules, attempting to update dictionaries', Object.keys(generated).length);

  Object.keys(generated).forEach((language) => {
    const filePath = dictionaryPattern.replace('[locale_code]', language);
    const seed = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : {};

    const dictionary = getSortedObject({ ...getCleanSeed(seed), ...generated[language] });
    const content = JSON.stringify(dictionary, null, 2);
    debug('saved %s locale to %s', language, filePath);
    fs.writeFileSync(filePath, content);
  });

  debug('Dictionaries successfully updated');

  return startTime;
};

const update = ({ keysRoot, moduleEnding, dictionaryPattern }) => {
  const startTime = Date.now();
  debug('attempting to update');

  const moduleRegex = new RegExp(`${escapeRegex(moduleEnding)}$`);

  const modules = getFiles(keysRoot, moduleRegex).reduce((acc, filePath) => {
    const id = getModuleId(keysRoot, moduleEnding, filePath);
    acc[id] = filePath;
    return acc;
  }, {});

  debug('found %d modules, attempting to read dictionaries', Object.keys(modules).length);

  const dictionariesRoot = path.dirname(dictionaryPattern);
  const dictionaryRegex = getDictionaryRegex(dictionaryPattern);

  const files = getFiles(dictionariesRoot, dictionaryRegex).reduce((acc, filePath) => {
    const language = getLanguage(filePath.replace(dictionariesRoot, ''));
    const dictionary = JSON.parse(fs.readFileSync(filePath));
    const generated = getCleanGenerated(dictionary);

    Object.keys(generated).forEach((id) => {
      if (!acc[id]) acc[id] = {};
      acc[id][language] = dictionary[id];
    });

    return acc;
  }, {});

  debug('found %d dictionaries, attempting to update modules', Object.keys(files).length);

  Object.keys(files).forEach((id) => {
    const filePath = modules[id];
    const content = JSON.stringify(files[id], null, 2);
    debug('saved module %s to %s', id, filePath);
    fs.writeFileSync(filePath, content);
  });

  debug('Modules successfully updated');

  return startTime;
};

const clean = ({ dictionaryPattern }) => {
  const startTime = Date.now();
  debug('attempting to clean');

  const files = getFiles(path.dirname(dictionaryPattern), getDictionaryRegex(dictionaryPattern));

  files.forEach((filePath) => {
    const dictionary = JSON.parse(fs.readFileSync(filePath));
    const seed = getCleanSeed(dictionary);

    const content = JSON.stringify(seed, null, 2);
    debug('cleaned %s', filePath);
    fs.writeFileSync(filePath, content);
  });

  debug('Dictionaries successfully cleaned');

  return startTime;
};

module.exports = { build, update, clean };
