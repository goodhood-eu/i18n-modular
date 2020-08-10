const path = require('path');
const { promisify } = require('util');
const validate = require('schema-utils');
const schema = require('./schema');
const {
  debug,

  rebase,
  getOptions,

  getModuleId,
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

    const { keysRoot, moduleEnding, emitFile } = options;

    this.modules = new Map();
    this.replacements = new Map();

    this.options = options;
    this.modulesOptions = { keysRoot, moduleEnding, store: this.modules };
    this.replacementsOptions = { emitFile, store: this.replacements };

    debug('initialized with options %O', options);
  }

  apply(compiler) {
    const { moduleEnding, dictionaryPattern, emitFile, keysRoot: relativeKeysRoot } = this.options;
    const { path: outputPath } = compiler.options.output;

    const keysRoot = rebase(compiler.context, relativeKeysRoot);
    const dictionaryRegex = getDictionaryRegex(rebase(compiler.context, dictionaryPattern));

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      const rebuildAsPromised = promisify(compilation.rebuildModule.bind(compilation));

      normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, (webpackModule) => {
        if (webpackModule.resource.endsWith(moduleEnding)) {
          debug('injected module loader for %s', webpackModule.resource);
          // Webpack only accepts loader names or paths to loader files
          webpackModule.loaders.push({
            loader: MODULE_LOADER,
            options: this.modulesOptions,
          });
        }

        if (dictionaryRegex.test(webpackModule.resource)) {
          debug('injected replacements loader for %s', webpackModule.resource);
          webpackModule.loaders.push({
            loader: REPLACEMENT_LOADER,
            options: this.replacementsOptions,
          });
        }
      });

      compilation.hooks.finishModules.tapPromise(PLUGIN_NAME, async(modules) => {
        const builtModules = modules.reduce((acc, webpackModule) => {
          if (!webpackModule.resource || !webpackModule.resource.endsWith(moduleEnding)) return acc;
          acc.push(getModuleId(keysRoot, moduleEnding, webpackModule.resource));
          return acc;
        }, []);

        const promises = modules.reduce((acc, webpackModule) => {
          if (dictionaryRegex.test(webpackModule.resource)) {
            const language = getLanguage(webpackModule.resource.replace(webpackModule.context, ''));
            const translations = collectModules(builtModules, this.modules, language);

            debug('collected %d language module(s) for %s', builtModules.length, language);
            storeTranslationModules(webpackModule, translations);

            debug('rebuilding %s', webpackModule.resource);
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

        compilation.modules
          .reduce((acc, webpackModule) => {
            if (!dictionaryRegex.test(webpackModule.resource)) return acc;
            acc.push(webpackModule.resource);
            return acc;
          }, [])
          .forEach((resourcePath) => {
            const data = this.replacements.get(resourcePath);

            const source = JSON.stringify(data, null, 2);

            // Webpack requires a path relative to the output folder
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
