const { validate } = require('schema-utils');
const merge = require('lodash/merge');
const pick = require('lodash/pick');

const {
  debug,

  rebase,
  getOptions: getPluginOptions,

  getModuleId,
  getDeepSortedObject,
} = require('../utils');

const pluginProperties = pick(require('../schema').properties, 'keysRoot', 'moduleEnding');

const REGEX_LOCALE = /^[a-z]{2,3}-[A-Z]{2,3}$/;

const schema = {
  type: 'object',
  properties: {
    store: {
      description: 'A storage for remapped keys, for example an instance of Map',
      type: 'object',
      properties: {
        set: {
          description: 'A setter function for the store',
          instanceof: 'Function',
        },
      },
      required: ['set'],
    },

    getId: {
      description: 'A function to convert file paths to module ids',
      instanceof: 'Function',
    },

    ...pluginProperties,
  },
  required: Object.keys(pluginProperties),
  additionalProperties: false,
};

const updateTree = (node, prefix) => (
  Object.keys(node).reduce((acc, key) => {
    const value = node[key];
    const keyPath = `${prefix}.${key}`;

    acc[key] = typeof value === 'string' ? keyPath : updateTree(value, keyPath);
    return acc;
  }, {})
);

const validateKeys = (filePath, keys) => {
  keys.forEach((key) => {
    if (!REGEX_LOCALE.test(key)) throw new Error(`Language key ${key} in ${filePath} is invalid`);
  });
};

const loader = function(source) {
  const options = pick(getPluginOptions(this.getOptions()), ...Object.keys(schema.properties));
  validate(schema, options, { name: 'I18nModular module loader' });

  const { store, moduleEnding } = options;
  const keysRoot = rebase(this._compiler.context, options.keysRoot);
  const getId = options.getId || getModuleId;

  const id = getId(keysRoot, moduleEnding, this.resourcePath);

  // Sorting early to have consistent results in merged trees and content hashing.
  const data = getDeepSortedObject(JSON.parse(source));
  const keys = Object.keys(data);

  validateKeys(this.resourcePath, keys);

  if (store) store.set(id, data);

  const tree = merge({}, ...keys.map((language) => data[language]));
  const result = updateTree(tree, id);

  debug('remapped keys for module %s', this.resourcePath);
  return JSON.stringify(result);
};

module.exports = loader;
