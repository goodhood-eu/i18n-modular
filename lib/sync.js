const fs = require('fs');
const path = require('path');
const escapeRegex = require('escape-string-regexp');

const {
  debug,

  getModuleId,
  reverseModuleId,

  getDictionaryRegex,
  getOutputPath,
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

const build = (options) => {
  const startTime = Date.now();
  debug('attempting to build');

  const moduleRegex = new RegExp(`${escapeRegex(options.moduleEnding)}$`);

  const generated = getFiles(options.keysRoot, moduleRegex).reduce((acc, filePath) => {
    const id = getModuleId(filePath, options.keysRoot, options.moduleEnding);
    const data = JSON.parse(fs.readFileSync(filePath));

    Object.keys(data).forEach((language) => {
      if (!acc[language]) acc[language] = {};
      acc[language][id] = getDeepSortedObject(data[language]);
    });

    return acc;
  }, {});

  debug('found %d modules, attempting to update dictionaries', Object.keys(generated).length);

  Object.keys(generated).forEach((language) => {
    const filePath = getOutputPath(options.dictionaryPattern, language);
    const seed = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : {};

    const dictionary = getSortedObject({ ...getCleanSeed(seed), ...generated[language] });
    const content = JSON.stringify(dictionary, null, 2);
    debug('saved %s locale to %s', language, filePath);
    fs.writeFileSync(filePath, content);
  });

  debug('Dictionaries successfully updated');

  return startTime;
};

const update = (options) => {
  const startTime = Date.now();
  debug('attempting to update');

  const dictionariesRoot = path.dirname(options.dictionaryPattern);
  const dictionaryRegex = getDictionaryRegex(path.basename(options.dictionaryPattern));

  const files = getFiles(dictionariesRoot, dictionaryRegex).reduce((acc, filePath) => {
    const language = getLanguage(filePath.replace(`${dictionariesRoot}/`, ''));
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
    const filePath = path.resolve(reverseModuleId(id, options.keysRoot, options.moduleEnding));
    const content = JSON.stringify(files[id], null, 2);
    debug('saved %s module to %s', id, filePath);
    fs.writeFileSync(filePath, content);
  });

  debug('Modules successfully updated');

  return startTime;
};

const clean = (options) => {
  const startTime = Date.now();
  debug('attempting to clean');

  const dictionariesRoot = path.dirname(options.dictionaryPattern);
  const dictionaryRegex = getDictionaryRegex(path.basename(options.dictionaryPattern));

  const files = getFiles(dictionariesRoot, dictionaryRegex);

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
