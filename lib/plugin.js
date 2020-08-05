const path = require('path');
const validate = require('schema-utils');
const schema = require('./schema');

const {
  debug,
  getOptions,

  getModuleId,
  getDictionaryRegex,

  getOutputPattern,
  getOutputPath,

  getLanguage,

  getCleanSeed,

  getSortedObject,
} = require('./utils');

const PLUGIN_NAME = 'I18nModularPlugin';

const MODULE_LOADER = path.resolve(`${__dirname}/loaders/module.js`);
const REPLACEMENT_LOADER = path.resolve(`${__dirname}/loaders/replacement.js`);

const REGEX_JSFILE = /\.js$/;


class I18nModularPlugin {
  constructor(_options) {
    const options = getOptions(_options);
    validate(schema, options, { name: 'I18nModular Plugin' });

    this.options = options;
    this.getModuleId = (filePath) => getModuleId(filePath, options.keysRoot, options.moduleEnding);

    this.modules = new Map();
    this.replacements = new Map();

    debug('initialized with options %O', options);
  }

  getModules(language) {
    return Array.from(this.modules.keys()).reduce((acc, id) => {
      acc[id] = this.modules.get(id)[language];
      return acc;
    }, {});
  }

  apply(compiler) {
    const { moduleEnding, dictionaryPattern } = this.options;
    const { path: compilerOutputPath } = compiler.options.output;
    const relativeOutputPath = compilerOutputPath.replace(compiler.context, '.');
    const outputPattern = getOutputPattern(dictionaryPattern || relativeOutputPath);
    const relativeDictionaryPath = path.join(compiler.context, outputPattern);
    const dictionaryRegex = getDictionaryRegex(relativeDictionaryPath);

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, (module) => {
        if (module.resource.endsWith(moduleEnding)) {
          debug('injected module loader for %s', module.resource);
          // A path to a JS file exporting a loader function must be provided.
          module.loaders.push({
            loader: MODULE_LOADER,
            options: { getId: this.getModuleId, store: this.modules },
          });
        }

        // The need for this loader could be avoided by using tokens in the source code
        // e.g. __WEBPACK_REPLACE_WITH_LOCALE_de-DE__ to be replaced with JSON content.
        if (dictionaryRegex.test(module.resource)) {
          debug('injected replacements loader for %s', module.resource);
          module.loaders.push({
            loader: REPLACEMENT_LOADER,
            options: { store: this.replacements },
          });
        }
      });

      compilation.hooks.finishModules.tap(PLUGIN_NAME, (modules) => {
        modules.forEach((module) => {
          if (dictionaryRegex.test(module.resource)) {
            const language = getLanguage(module.resource.replace(module.context, ''));
            module.__i18n_modular = this.getModules(language);

            debug('added language modules to %s, triggering rebuild', module.resource);
            compilation.rebuildModule(module, () => {
              debug('rebuilt %s', module.resource);
            });
          }
        });
      });
    });

    compiler.hooks.emit.tapAsync(PLUGIN_NAME, (compilation, callback) => {
      debug('building dictionaries');

      Array.from(this.replacements.keys()).forEach((resourcePath) => {
        const data = this.replacements.get(resourcePath);

        // Webpack is unable to save assets to absolute paths, a relative to the output folder
        // must be provided. 🤷‍♂️
        const relativePath = path.relative(compilerOutputPath, resourcePath);
        const source = JSON.stringify(data, null, 2);

        compilation.assets[relativePath] = {
          source: () => Buffer.from(source),
          size: () => Buffer.byteLength(source),
        };

        debug('updated %s', resourcePath);
      });

      callback();
    });
  }
}

module.exports = I18nModularPlugin;
