const path = require('path');
const { getOptions } = require('loader-utils');
const validate = require('schema-utils');
const merge = require('lodash/merge');
const pick = require('lodash/pick');
const { debug, getDeepSortedObject, getModuleId, getOptions: getPluginOptions } = require('../utils');
const pluginSchema = require('../schema');

const pluginOptions = pick(pluginSchema.properties, 'keysRoot', 'moduleEnding');

const REGEX_LOCALE = /^[a-z]{2,3}-[A-Z]{2,3}$/;

const schema = {
  type: 'object',
  properties: {
    store: {
      description: 'An instance of Map to store remapped keys',
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
      description: 'A method to get ids from file paths',
      instanceof: 'Function',
    },

    ...pluginOptions,
  },
  required: Object.keys(pluginOptions),
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
  const options = pick(getPluginOptions(getOptions(this)), ...Object.keys(schema.properties));
  validate(schema, options, { name: 'I18nModular module loader' });

  const { store, getId, moduleEnding } = options;
  const keysRoot = path.join(this._compiler.context, options.keysRoot);
  const generateId = getId || getModuleId.bind(null, keysRoot, moduleEnding);

  const id = generateId(this.resourcePath);
  // Sorting early to have consistent results in props merge and content hashing
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
