const path = require('path');
const { promisify } = require('util');
const validate = require('schema-utils');
const schema = require('./schema');
const {
  debug,

  rebase,
  getOptions,

  getDictionaryRegex,
  getLanguage,

  storeTranslationModules,

  collectModules,
} = require('./utils');

const PLUGIN_NAME = 'I18nModularPlugin';

const MODULE_LOADER = path.resolve(`${__dirname}/loaders/module.js`);
const REPLACEMENT_LOADER = path.resolve(`${__dirname}/loaders/replacement.js`);


class I18nModularPlugin {
  constructor(_options) {
    const options = getOptions(_options);
    validate(schema, options, { name: 'I18nModular Plugin' });

    this.modules = new Map();
    this.replacements = new Map();

    this.options = options;
    debug('initialized with options %O', options);
  }

  apply(compiler) {
    const { keysRoot, moduleEnding, dictionaryPattern, emitFile } = this.options;

    const modulesOptions = { keysRoot, moduleEnding, store: this.modules };
    const replacementsOptions = { emitFile, store: this.replacements };

    const dictionaryRegex = getDictionaryRegex(rebase(compiler.context, dictionaryPattern));
    const { path: outputPath } = compiler.options.output;

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      const rebuildAsPromised = promisify(compilation.rebuildModule.bind(compilation));

      normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, (webpackModule) => {
        if (webpackModule.resource.endsWith(moduleEnding)) {
          debug('injected module loader for %s', webpackModule.resource);
          // Webpack only accepts loader names or paths to loader files
          webpackModule.loaders.push({ loader: MODULE_LOADER, options: modulesOptions });
        }

        if (dictionaryRegex.test(webpackModule.resource)) {
          debug('injected replacements loader for %s', webpackModule.resource);
          webpackModule.loaders.push({ loader: REPLACEMENT_LOADER, options: replacementsOptions });
        }
      });

      compilation.hooks.finishModules.tapPromise(PLUGIN_NAME, async(modules) => {
        const promises = modules.reduce((acc, webpackModule) => {
          if (dictionaryRegex.test(webpackModule.resource)) {
            const language = getLanguage(webpackModule.resource.replace(webpackModule.context, ''));

            storeTranslationModules(webpackModule, collectModules(this.modules, language));

            debug('added language modules to %s, triggering rebuild', webpackModule.resource);
            acc.push(rebuildAsPromised(webpackModule));
          }

          return acc;
        }, []);

        await Promise.all(promises);
      });
    });

    if (emitFile) {
      compiler.hooks.emit.tap(PLUGIN_NAME, (compilation) => {
        debug('building dictionaries');

        Array.from(this.replacements.keys()).forEach((resourcePath) => {
          const data = this.replacements.get(resourcePath);

          // Webpack requires a path relative to the output folder
          const source = JSON.stringify(data, null, 2);

          compilation.assets[path.relative(outputPath, resourcePath)] = {
            source: () => Buffer.from(source),
            size: () => Buffer.byteLength(source),
          };

          debug('added %s to assets', resourcePath);
        });
      });
    }
  }
}

I18nModularPlugin.loader = MODULE_LOADER;
module.exports = I18nModularPlugin;
