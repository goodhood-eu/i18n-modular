const { getOptions } = require('loader-utils');
const validate = require('schema-utils');
const merge = require('lodash/merge');
const defaults = require('lodash/defaults');
const { debug, getDeepSortedObject } = require('../utils');

const REGEX_LOCALE = /^[a-z]{2,3}-[A-Z]{2,3}$/;

const schema = {
  type: 'object',
  properties: {
    store: {
      type: 'object',
      properties: {
        set: {
          instanceof: 'Function',
        },
      },
      required: ['set'],
    },

    getId: {
      instanceof: 'Function',
    },
  },
  required: ['getId'],
  additionalProperties: false,
};

// "." might be mistaken for an object lookup by the internationalization engine e.g. Polyglot.
const getDefaultId = (key) => key.replace(/\./g, ':');

const defaultOptions = { getId: getDefaultId };

const updateTree = (node, prefix) => (
  Object.keys(node).reduce((acc, key) => {
    const value = node[key];
    const path = `${prefix}.${key}`;

    acc[key] = typeof value === 'string' ? path : updateTree(value, path);
    return acc;
  }, {})
);

const validateKeys = (filePath, keys) => {
  keys.forEach((key) => {
    if (!REGEX_LOCALE.test(key)) throw new Error(`Language key ${key} in ${filePath} is invalid`);
  });
};

const loader = function(source) {
  const options = defaults({}, getOptions(this), defaultOptions);
  validate(schema, options, { name: 'I18nModular module loader' });

  const { store, getId } = options;

  const id = getId(this.resourcePath);
  const data = JSON.parse(source);
  const keys = Object.keys(data);

  validateKeys(this.resourcePath, keys);

  if (store) store.set(id, getDeepSortedObject(data));

  const tree = merge({}, ...keys.map((language) => data[language]));
  debug('remapped keys for module %s', this.resourcePath);
  return JSON.stringify(updateTree(tree, id));
};

module.exports = loader;
