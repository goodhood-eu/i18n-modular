const path = require('path');
const { promisify } = require('util');
const { validate } = require('schema-utils');
const { Compilation: { PROCESS_ASSETS_STAGE_DERIVED } } = require('webpack');
const { RawSource } = require('webpack-sources');
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
      normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, ({ createData }) => {
        if (createData.resource.endsWith(moduleEnding)) {
          debug('injected module loader for %s', createData.resource);
          // Webpack only accepts loader names or paths to loader files
          createData.loaders.push({
            loader: MODULE_LOADER,
            options: this.modulesOptions,
          });
        }

        if (dictionaryRegex.test(createData.resource)) {
          debug('injected replacements loader for %s', createData.resource);
          createData.loaders.push({
            loader: REPLACEMENT_LOADER,
            options: this.replacementsOptions,
          });
        }
      });

      compilation.hooks.finishModules.tapPromise(PLUGIN_NAME, (moduleSet) => {
        const modules = Array.from(moduleSet);

        // It might be faster overall to move this section closer to the rebuild call
        const builtModules = modules.reduce((acc, webpackModule) => {
          if (webpackModule.resource && webpackModule.resource.endsWith(moduleEnding)) {
            debug('adding %s to built modules list', webpackModule.resource);
            acc.push(getModuleId(keysRoot, moduleEnding, webpackModule.resource));
          }
          return acc;
        }, []);

        const promises = modules.reduce((acc, webpackModule) => {
          if (dictionaryRegex.test(webpackModule.resource)) {
            const rebuildAsPromised = promisify(compilation.rebuildModule.bind(compilation));

            const language = getLanguage(webpackModule.resource.replace(webpackModule.context, ''));
            const translations = collectModules(builtModules, this.modules, language);

            debug('collected %d language module(s) for %s', builtModules.length, language);
            storeTranslationModules(webpackModule, translations);

            debug('rebuilding %s', webpackModule.resource);
            acc.push(rebuildAsPromised(webpackModule));
          }

          return acc;
        }, []);

        return Promise.all(promises);
      });

      if (emitFile) {
        compilation.hooks.processAssets.tap({
          name: PLUGIN_NAME,
          stage: PROCESS_ASSETS_STAGE_DERIVED,
        }, (assets) => {
          debug('building dictionaries');

          Array.from(compilation.modules).forEach(({ resource }) => {
            if (!dictionaryRegex.test(resource)) return;

            const data = this.replacements.get(resource);
            const source = JSON.stringify(data, null, 2);

            // Webpack requires a path relative to the output folder
            assets[path.relative(outputPath, resource)] = new RawSource(source);
            debug('added %s to assets', resource);
          });
        });
      }
    });
  }
}

I18nModularPlugin.loader = MODULE_LOADER;
module.exports = I18nModularPlugin;
