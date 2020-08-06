const { getOptions } = require('loader-utils');
const validate = require('schema-utils');
const pick = require('lodash/pick');
const { debug, getSortedObject, getCleanSeed, getTranslationModules } = require('../utils');
const pluginProperties = pick(require('../schema').properties, 'emitFile');

const schema = {
  type: 'object',
  properties: {
    store: {
      description: 'A storage for updated files, for example an instance of Map',
      type: 'object',
      properties: {
        set: {
          description: 'A setter function for the store',
          instanceof: 'Function',
        },
      },
      required: ['set'],
    },

    ...pluginProperties,
  },
  required: ['store'],
  additionalProperties: false,
};

const loader = function(source) {
  const options = getOptions(this);
  validate(schema, options, { name: 'I18nModular replacement loader' });

  const { store, emitFile } = options;

  if (typeof emitFile === 'undefined' || emitFile) {
    // Stops webpack from watching changes to the dictionary.
    // We need this since we read and write to the same file.
    debug('stopped checking %s for changes', this.resourcePath);
    this.clearDependencies();
  }

  const modules = getTranslationModules(this._module);
  if (!modules) return source;

  const data = getCleanSeed(JSON.parse(source));

  // Not deep sorting because modules are deep sorted and the dictionary is pre-sorted as well.
  const result = getSortedObject({ ...data, ...modules });
  store.set(this.resourcePath, result);

  debug('replaced content of %s', this.resourcePath);
  return JSON.stringify(result);
};

module.exports = loader;
