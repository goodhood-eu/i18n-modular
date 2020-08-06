const path = require('path');
const { promisify } = require('util');
const validate = require('schema-utils');
const pick = require('lodash/pick');
const schema = require('./schema');

const {
  debug,
  getOptions,

  getDictionaryRegex,

  getOutputPattern,

  getLanguage,
} = require('./utils');

const PLUGIN_NAME = 'I18nModularPlugin';

const MODULE_LOADER = path.resolve(`${__dirname}/loaders/module.js`);
const REPLACEMENT_LOADER = path.resolve(`${__dirname}/loaders/replacement.js`);


class I18nModularPlugin {
  constructor(_options) {
    const options = getOptions(_options);
    validate(schema, options, { name: 'I18nModular Plugin' });

    this.options = options;
    this.loaderOptions = pick(options, 'keysRoot', 'moduleEnding');

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
      const rebuildAsPromised = promisify(compilation.rebuildModule.bind(compilation));

      normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, (webpackModule) => {
        if (webpackModule.resource.endsWith(moduleEnding)) {
          debug('injected module loader for %s', webpackModule.resource);
          // A path to a JS file exporting a loader function must be provided.
          webpackModule.loaders.push({
            loader: MODULE_LOADER,
            options: { ...this.loaderOptions, store: this.modules },
          });
        }

        if (dictionaryRegex.test(webpackModule.resource)) {
          debug('injected replacements loader for %s', webpackModule.resource);
          webpackModule.loaders.push({
            loader: REPLACEMENT_LOADER,
            options: { store: this.replacements },
          });
        }
      });

      compilation.hooks.finishModules.tapPromise(PLUGIN_NAME, async(modules) => {
        const promises = modules.reduce((acc, webpackModule) => {
          if (dictionaryRegex.test(webpackModule.resource)) {
            const language = getLanguage(webpackModule.resource.replace(webpackModule.context, ''));
            webpackModule.__i18n_modular = this.getModules(language);

            debug('added language modules to %s, triggering rebuild', webpackModule.resource);
            acc.push(rebuildAsPromised(webpackModule));
          }

          return acc;
        }, []);

        await Promise.all(promises);
      });
    });

    if (typeof this.options.emitFile === 'undefined' || this.options.emitFile) {
      compiler.hooks.emit.tap(PLUGIN_NAME, (compilation) => {
        debug('building dictionaries');

        Array.from(this.replacements.keys()).forEach((resourcePath) => {
          const data = this.replacements.get(resourcePath);

          // Webpack requires a path relative to the output folder
          const relativePath = path.relative(compilerOutputPath, resourcePath);
          const source = JSON.stringify(data, null, 2);

          compilation.assets[relativePath] = {
            source: () => Buffer.from(source),
            size: () => Buffer.byteLength(source),
          };

          debug('updated %s', resourcePath);
        });
      });
    }
  }
}

I18nModularPlugin.loader = require(MODULE_LOADER);
module.exports = I18nModularPlugin;
