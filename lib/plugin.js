const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { validate } = require('schema-utils');
const { WatchIgnorePlugin, Compilation: { PROCESS_ASSETS_STAGE_DERIVED } } = require('webpack');
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
  createModule,
} = require('./utils');

const PLUGIN_NAME = 'I18nModularPlugin';

const MODULE_LOADER = path.resolve(`${__dirname}/loaders/module.js`);
const REPLACEMENT_LOADER = path.resolve(`${__dirname}/loaders/replacement.js`);


class I18nModularPlugin {
  constructor(_options) {
    const options = getOptions(_options);
    validate(schema, options, { name: 'I18nModular Plugin' });

    const { keysRoot, moduleEnding, emitFile, getId } = options;

    this.modules = new Map();
    this.replacements = new Map();

    this.options = options;
    this.getId = getId || getModuleId;
    this.modulesOptions = { keysRoot, moduleEnding, getId };
    this.replacementsOptions = { emitFile, store: this.replacements };

    debug('initialized with options %O', options);
  }

  apply(compiler) {
    const { moduleEnding, dictionaryPattern, emitFile, keysRoot: relativeKeysRoot } = this.options;
    const { path: outputPath } = compiler.options.output;

    const keysRoot = rebase(compiler.context, relativeKeysRoot);
    const dictionaryRegex = getDictionaryRegex(rebase(compiler.context, dictionaryPattern));

    // Stops watching dictionary files to avoid rebuild loops in watch mode
    if (emitFile) {
      new WatchIgnorePlugin({ paths: [dictionaryRegex] }).apply(compiler);
      debug('stopped checking %o for changes', dictionaryRegex);
    }

    // Attaches loaders to modules and dictionary files
    // Using `thisCompilation` avoids `processAssets` being called prematurely
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, ({ createData }) => {
        if (createData.resource.endsWith(moduleEnding)) {
          debug('injected module loader for %s', createData.resource);
          // Webpack only accepts loader names or absolute paths to loader files
          // This will replace module JSON with paths to dictionary
          createData.loaders.push({
            loader: MODULE_LOADER,
            options: this.modulesOptions,
          });
        }

        // This will update dictionaries in memory and bundle output
        // But not the source dictionary files on disk
        if (dictionaryRegex.test(createData.resource)) {
          debug('injected replacements loader for %s', createData.resource);
          createData.loaders.push({
            loader: REPLACEMENT_LOADER,
            options: this.replacementsOptions,
          });
        }
      });

      // This forces dictionaries to rebuild in memory after all modules were collected
      compilation.hooks.finishModules.tapPromise(PLUGIN_NAME, (moduleSet) => {
        const modules = Array.from(moduleSet);

        // It might be faster overall to move this section closer to the rebuild call
        // Collecting translations that are available in the current build
        // This way in watch mode we always have up to date file list
        const builtModules = modules.reduce((acc, { resource }) => {
          if (resource?.endsWith(moduleEnding)) {
            debug('adding %s to built modules list', resource);
            const id = this.getId(keysRoot, moduleEnding, resource);
            try {
              const data = createModule(fs.readFileSync(resource));
              this.modules.set(id, data);
              acc.push(id);
            } catch (error) {
              const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);
              logger.warn(`Error reading translations module "${resource}": ${error.message}`);
              logger.debug(error.stack);
            }
          }
          return acc;
        }, []);

        // Populating dictionaries from the modules
        const promises = modules.reduce((acc, webpackModule) => {
          if (!dictionaryRegex.test(webpackModule.resource)) return acc;

          const rebuildAsPromised = promisify(compilation.rebuildModule.bind(compilation));

          const language = getLanguage(webpackModule.resource.replace(webpackModule.context, ''));
          const translations = collectModules(builtModules, this.modules, language);

          debug('collected %d language module(s) for %s', builtModules.length, language);
          storeTranslationModules(webpackModule, translations);

          debug('rebuilding %s', webpackModule.resource);
          acc.push(rebuildAsPromised(webpackModule));

          return acc;
        }, []);

        return Promise.all(promises);
      });

      // Saves dictionary files to the disk (or virtual FS in watch mode)
      if (emitFile) {
        compilation.hooks.processAssets.tap({
          name: PLUGIN_NAME,
          stage: PROCESS_ASSETS_STAGE_DERIVED,
        }, (assets) => {
          debug('building dictionaries');

          Array.from(compilation.modules).forEach(({ resource }) => {
            if (!dictionaryRegex.test(resource)) return;

            const data = this.replacements.get(resource);
            if (!data) return debug('failed to save "%s": no content', resource);

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
