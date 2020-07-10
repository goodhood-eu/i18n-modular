const path = require('path');
const defaults = require('lodash/defaults');
const escapeRegex = require('escape-string-regexp');
const debug = require('debug')('i18n_modular');

const REGEX_JSON_ENDING = /\.json$/;
const REGEX_LOCALE_PLACEHOLDER = /[[]locale_code[\]]/;
const REGEX_ESCAPED_LOCALE_PLACEHOLDER = /\\[[]locale_code\\[\]]/;
const REGEX_LOCALE = /([a-z]{2,3}-[A-Z]{2,3})/;
const REGEX_SPECIAL_CHARACTER = /[^\w]|_/;

const ID_PREFIX = 'module:';

const defaultOptions = {
  keysRoot: process.cwd(),
  moduleEnding: '.translations.json',
};

const getOptions = (options) => {
  let rc = {};
  try {
    rc = require(`${process.cwd()}/.i18n-modular-rc`);
  } catch (_e) { /* no action required */ }

  const { keysRoot, ...rest } = defaults({}, options, rc, defaultOptions);

  return {
    ...rest,
    keysRoot: path.resolve(keysRoot),
  };
};

const getModuleId = (filePath, keysRoot, moduleEnding) => (
  `${ID_PREFIX}${
    filePath
      .replace(`${keysRoot}/`, '')
      .replace(moduleEnding, '')
      // `:` can't be a part of a file name, remove the dots to not confuse them with object lookups
      .replace(/\./g, ':')
  }`
);

const reverseModuleId = (moduleId, keysRoot, moduleEnding) => (
  `${keysRoot}/${
    moduleId
      .replace(ID_PREFIX, '')
      .replace(/:/g, '.')
  }${moduleEnding}`
);

const getOutputPattern = (pattern) => {
  if (!pattern) return null;
  const normalizedPath = REGEX_JSON_ENDING.test(pattern) ? pattern : `${pattern}/[locale_code].json`;
  return path.resolve(normalizedPath);
};

const getDictionaryRegex = (filePath) => new RegExp(`${
  escapeRegex(filePath)
    .replace(
      REGEX_ESCAPED_LOCALE_PLACEHOLDER,
      REGEX_LOCALE.toString().slice(1, -1),
    )
}$`);

const getOutputPath = (outputPattern, language) => (
  path.resolve(outputPattern.replace(REGEX_LOCALE_PLACEHOLDER, language))
);

const getLanguage = (filePath) => (filePath.match(REGEX_LOCALE) || [])[0];

const getSeedPattern = (id) => `JSON.parse("\\"${id}\\"")`;

const getCleanSeed = (source) => (
  Object.keys(source)
    .filter((key) => !key.startsWith(ID_PREFIX))
    .reduce((acc, key) => {
      acc[key] = source[key];
      return acc;
    }, {})
);

const getCleanGenerated = (source) => (
  Object.keys(source)
    .filter((key) => key.startsWith(ID_PREFIX))
    .reduce((acc, key) => {
      acc[key] = source[key];
      return acc;
    }, {})
);

// Sorting of object keys is necessary to avoid diffs in dictionaries after phraseapp sync.
// This seems to be a simple alphabetical sort and it is. We need it because default javascript
// implementation sorts special characters differently from other languages, thus creating diffs
// inside generated JSON files.
const sortFn = (a, b) => {
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    const charA = a.charAt(i);
    const charB = b.charAt(i);

    if (charA === charB) continue;

    if (charA && !charB) return 1;
    if (!charA && charB) return -1;

    const specialA = REGEX_SPECIAL_CHARACTER.test(charA);
    const specialB = REGEX_SPECIAL_CHARACTER.test(charB);

    if (specialA && !specialB) return 1;
    if (!specialA && specialB) return -1;

    return charA.localeCompare(charB, 'en-US');
  }

  return 0;
};

const getSortedObject = (source, recursive = false) => (
  Object.keys(source)
    .sort(sortFn)
    .reduce((acc, key) => {
      const value = source[key];
      const recurse = recursive && typeof value === 'object';
      acc[key] = recurse ? getSortedObject(value, recursive) : value;
      return acc;
    }, {})
);

const getDeepSortedObject = (source) => getSortedObject(source, true);

module.exports = {
  debug,
  getOptions,
  getModuleId,
  reverseModuleId,
  getOutputPattern,
  getDictionaryRegex,
  getOutputPath,
  getLanguage,
  getSeedPattern,
  getCleanGenerated,
  getCleanSeed,
  getSortedObject,
  getDeepSortedObject,
};
