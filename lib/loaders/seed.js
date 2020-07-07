const { getOptions } = require('loader-utils');
const validate = require('schema-utils');
const { debug, getLanguage } = require('../utils');

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
  },
  required: ['store'],
  additionalProperties: false,
};


const getId = (language) => `__WEBPACK_I18N_MODULAR_GENERATED_LOCALE_${language}__`;

const loader = function(source) {
  const options = getOptions(this);
  validate(schema, options, { name: 'I18nModular seed loader' });

  const { store } = options;

  const language = getLanguage(this.resourcePath.replace(this.context, ''));

  const id = getId(language);
  const data = JSON.parse(source);

  // Stops webpack from watching changes to the dictionary.
  // We need this since we read and write to the same file.
  this.clearDependencies();
  store.set(id, { language, data });

  debug('replaced and unsubscribed %s', this.resourcePath);

  // Must stringify output since it's impossible to overwrite JSONParser of Webpack 🤷‍♂️
  return JSON.stringify(id);
};

module.exports = loader;
