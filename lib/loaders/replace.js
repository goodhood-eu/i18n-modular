const { getOptions } = require('loader-utils');
const validate = require('schema-utils');
const { debug, getSortedObject, getCleanSeed } = require('../utils');

const schema = {
  type: 'object',
  properties: {
    store: {
      type: 'object',
      properties: {
        keys: {
          instanceof: 'Function',
        },
        get: {
          instanceof: 'Function',
        },
      },
      required: ['keys', 'get'],
    },
  },
  required: ['store'],
  additionalProperties: false,
};

const loader = function(source) {
  const options = getOptions(this);
  validate(schema, options, { name: 'I18nModular replace loader' });

  const { store } = options;
  const data = JSON.parse(source);

  const content = getSortedObject({ ...getCleanSeed(data), ...this._module._i18n_modules });

  debug('updated content of %s', this.resourcePath);

  // Must stringify output since it's impossible to overwrite JSONParser of Webpack 🤷‍♂️
  return JSON.stringify(content);
};

module.exports = loader;
