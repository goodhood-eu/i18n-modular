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
    const filePath = path.join(dirPath, fileName);

    if (fs.statSync(filePath).isDirectory()) return acc.concat(getFiles(filePath, regex));
    if (regex.test(filePath)) acc.push(filePath);
    return acc;
  }, [])
);

const build = ({ keysRoot, moduleEnding, dictionaryPattern }) => {
  const startTime = Date.now();
  debug('attempting to build dictionaries');

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

  debug('found %d module files, attempting to update dictionaries', Object.keys(generated).length);

  Object.keys(generated).forEach((language) => {
    const filePath = dictionaryPattern.replace('[locale_code]', language);
    const seed = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : {};

    const dictionary = getSortedObject({ ...getCleanSeed(seed), ...generated[language] });
    const content = JSON.stringify(dictionary, null, 2);
    debug('saved %s locale to %s', language, filePath);
    fs.writeFileSync(filePath, content);
  });

  debug('dictionaries updated successfully');

  return startTime;
};

const update = ({ keysRoot, moduleEnding, dictionaryPattern }) => {
  const startTime = Date.now();
  debug('attempting to update module files');

  const dictionariesRoot = path.dirname(dictionaryPattern);
  const dictionaryRegex = getDictionaryRegex(dictionaryPattern);

  const moduleValues = getFiles(dictionariesRoot, dictionaryRegex).reduce((acc, filePath) => {
    const language = getLanguage(filePath.replace(dictionariesRoot, ''));
    const dictionary = JSON.parse(fs.readFileSync(filePath));
    const generated = getCleanGenerated(dictionary);

    Object.keys(generated).forEach((id) => {
      if (!acc[id]) acc[id] = {};
      acc[id][language] = dictionary[id];
    });

    return acc;
  }, {});

  debug('found %d module ids in dictionaries', Object.keys(moduleValues).length);

  const moduleRegex = new RegExp(`${escapeRegex(moduleEnding)}$`);

  getFiles(keysRoot, moduleRegex).forEach((filePath) => {
    const id = getModuleId(keysRoot, moduleEnding, filePath);
    const value = moduleValues[id];

    // Module is not present in the dictionary yet
    if (!value) return;

    const content = JSON.stringify(value, null, 2);
    debug('saved module %s to %s', id, filePath);
    fs.writeFileSync(filePath, content);
  });

  debug('modules updated successfully');

  return startTime;
};

const clean = ({ dictionaryPattern }) => {
  const startTime = Date.now();
  debug('attempting to clean');

  const dictionariesRoot = path.dirname(dictionaryPattern);
  const dictionaryRegex = getDictionaryRegex(dictionaryPattern);

  getFiles(dictionariesRoot, dictionaryRegex).forEach((filePath) => {
    const dictionary = JSON.parse(fs.readFileSync(filePath));
    const seed = getCleanSeed(dictionary);

    const content = JSON.stringify(seed, null, 2);
    debug('cleaned dictionary at %s', filePath);
    fs.writeFileSync(filePath, content);
  });

  debug('dictionaries cleaned successfully');

  return startTime;
};

module.exports = { build, update, clean };
