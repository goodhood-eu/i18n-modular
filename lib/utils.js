const path = require('path');
const defaults = require('lodash/defaults');
const escapeRegex = require('escape-string-regexp');
const debug = require('debug')('i18n_modular');

const REGEX_ESCAPED_LOCALE_PLACEHOLDER = /\\\[locale_code\\\]/;
const REGEX_LOCALE = /([a-z]{2,3}-[A-Z]{2,3})/;
const REGEX_STRICT_LOCALE = /^[a-z]{2,3}-[A-Z]{2,3}$/;
const REGEX_SPECIAL_CHARACTER = /[^\w]|_/;
const REGEX_LEADING_SLASH = /^\//;

const RC_CONFIG_NAME = '.i18n-modular-rc';
const ENV_CONTEXT_NAME = 'I18N_MODULAR_CONTEXT';
const ID_PREFIX = 'module:';
const INJECTED_TRANSLATIONS_KEY = '__i18n_modular_translations';

const defaultOptions = {
  keysRoot: './',
  moduleEnding: '.translations.json',
  emitFile: true,
};

const rebase = (context, filePath = '.') => {
  if (REGEX_LEADING_SLASH.test(filePath)) return filePath;
  return path.join(context || process.cwd(), filePath);
};

const getContext = () => rebase(process.cwd(), process.env[ENV_CONTEXT_NAME]);

const getOptions = (options) => {
  let rc = {};
  try { rc = require(`${getContext()}/${RC_CONFIG_NAME}`); } catch (_) { /* no action required */ }
  return defaults({}, options, rc, defaultOptions);
};

const getModuleId = (keysRoot, moduleEnding, filePath) => (
  `${ID_PREFIX}${
    filePath
      .replace(keysRoot, '')
      .replace(moduleEnding, '')
      .replace(REGEX_LEADING_SLASH, '')
      // `:` can't be a part of a file name, remove the dots to not confuse them with object lookups
      .replace(/\./g, ':')
  }`
);

const getDictionaryRegex = (filePath) => new RegExp(`${
  escapeRegex(filePath)
    .replace(
      REGEX_ESCAPED_LOCALE_PLACEHOLDER,
      REGEX_LOCALE.toString().slice(1, -1),
    )
}$`);

const getLanguage = (filePath) => (filePath.match(REGEX_LOCALE) || [])[0];

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

const storeTranslationModules = (webpackModule = {}, data) => {
  webpackModule[INJECTED_TRANSLATIONS_KEY] = data;
  return webpackModule;
};
const getTranslationModules = (webpackModule = {}) => webpackModule[INJECTED_TRANSLATIONS_KEY];

const collectModules = (keys, map, language) => (
  keys.reduce((acc, key) => {
    const value = map.get(key)?.[language];
    if (value) acc[key] = value;
    return acc;
  }, {})
);

const validateKeys = (keys) => {
  keys.forEach((key) => {
    if (!REGEX_STRICT_LOCALE.test(key)) throw new Error(`Language key ${key} is invalid`);
  });
};

const createModule = (source) => {
  // Sorting early to have consistent results in merged trees and content hashing.
  const data = getDeepSortedObject(JSON.parse(source));
  const keys = Object.keys(data);

  validateKeys(keys);
  return data;
};

module.exports = {
  debug,
  rebase,
  getContext,
  getOptions,
  getModuleId,
  getDictionaryRegex,
  getLanguage,
  getCleanGenerated,
  getCleanSeed,
  getSortedObject,
  getDeepSortedObject,
  storeTranslationModules,
  getTranslationModules,
  collectModules,
  validateKeys,
  createModule,
};
