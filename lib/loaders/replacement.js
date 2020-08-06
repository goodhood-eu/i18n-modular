const { getOptions } = require('loader-utils');
const validate = require('schema-utils');
const { debug, getSortedObject, getCleanSeed } = require('../utils');

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
  },
  required: ['store'],
  additionalProperties: false,
};

const loader = function(source) {
  const options = getOptions(this);
  validate(schema, options, { name: 'I18nModular replacement loader' });

  // Stops webpack from watching changes to the dictionary.
  // We need this since we read and write to the same file.
  this.clearDependencies();

  const { __i18n_modular: modules } = this._module;

  if (!modules) {
    debug('unsubscribed %s, no replacements available yet', this.resourcePath);
    return source;
  }

  const { store } = options;
  const data = getCleanSeed(JSON.parse(source));

  const result = getSortedObject({ ...data, ...modules });
  store.set(this.resourcePath, result);

  debug('replaced content of %s', this.resourcePath);
  return JSON.stringify(result);
};

module.exports = loader;
