const { getOptions } = require('loader-utils');
const validate = require('schema-utils');
const { debug, getLanguage, getSortedObject, getCleanSeed } = require('../utils');

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

const getModules = (store, language) => Array.from(store.keys()).reduce((acc, id) => {
  acc[id] = store.get(id)[language];
  return acc;
}, {});

const loader = function(source) {
  const options = getOptions(this);
  validate(schema, options, { name: 'I18nModular replace loader' });

  const { store } = options;

  const language = getLanguage(this.resourcePath.replace(this.context, ''));

  const data = JSON.parse(source);
  const modules = getModules(store, language);

  const content = getSortedObject({ ...getCleanSeed(data), ...modules });

  debug('updated content of %s', this.resourcePath);

  // Must stringify output since it's impossible to overwrite JSONParser of Webpack 🤷‍♂️
  return JSON.stringify(content);
};

module.exports = loader;
