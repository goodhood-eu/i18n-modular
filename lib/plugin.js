const path = require('path');
const Compilation = require('webpack/lib/Compilation');
const { ReplaceSource } = require('webpack-sources');
const validate = require('schema-utils');

const schema = require('./schema');

const {
  debug,
  getOptions,

  getModuleId,
  getDictionaryRegex,

  getOutputPattern,
  getOutputPath,

  getSeedPattern,
  getCleanSeed,

  getSortedObject,
} = require('./utils');

const PLUGIN_NAME = 'I18nModularPlugin';

const MODULE_LOADER = path.resolve(`${__dirname}/loaders/module.js`);
const SEED_LOADER = path.resolve(`${__dirname}/loaders/seed.js`);
const REPLACE_LOADER = path.resolve(`${__dirname}/loaders/replace.js`);

const REGEX_JSFILE = /\.js$/;


class I18nModularPlugin {
  constructor(_options) {
    const options = getOptions(_options);
    validate(schema, options, { name: 'I18nModular Plugin' });

    this.options = options;
    this.getModuleId = (filePath) => getModuleId(filePath, options.keysRoot, options.moduleEnding);
    this.modules = new Map();
    this.seeds = new Map();

    debug('initialized with options %O', options);
  }

  getModules(language) {
    return Array.from(this.modules.keys()).reduce((acc, id) => {
      acc[id] = this.modules.get(id)[language];
      return acc;
    }, {});
  }

  getDictionary(id) {
    const { language, data } = this.seeds.get(id);
    return getSortedObject({ ...getCleanSeed(data), ...this.getModules(language) });
  }

  apply(compiler) {
    const { moduleEnding, dictionaryPattern } = this.options;
    const { path: compilerOutputPath } = compiler.options.output;
    const outputPattern = getOutputPattern(dictionaryPattern || compilerOutputPath);
    const relativeDictionaryPath = outputPattern.replace(compiler.context, '');
    const dictionaryRegex = getDictionaryRegex(relativeDictionaryPath);

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation, { normalModuleFactory }) => {
      normalModuleFactory.hooks.afterResolve.tap(PLUGIN_NAME, (module) => {
        if (module.resource.endsWith(moduleEnding)) {
          debug('injected module loader for %s', module.resource);
          // Webpack is unable to accept a loader function directly 🤷‍♂️
          // A path to a JS file exporting a loader function must be provided.
          module.loaders.push({
            loader: MODULE_LOADER,
            options: { getId: this.getModuleId, store: this.modules },
          });
        }

        // The need for this loader could be avoided by using tokens in the source code
        // e.g. __WEBPACK_REPLACE_WITH_LOCALE_de-DE__ to be replaced with JSON content.
        if (dictionaryRegex.test(module.resource)) {
          debug('injected seed loader for %s', module.resource);
          module.loaders.push({
            loader: SEED_LOADER,
            options: { store: this.modules },
          });
        }
      });

      compilation.hooks.finishModules.tapAsync(PLUGIN_NAME, (modules, done) => {
        debug('first pass finished, attempting to find modules to replace');

        modules.forEach((module) => {
          if (dictionaryRegex.test(module.resource)) {
            debug('injected replace loader for %s', module.resource);

            module.loaders.push({
              loader: REPLACE_LOADER,
              options: { store: this.seeds },
            });

            debug('triggering rebuild for %s', module.resource);
            compilation.rebuildModule(module, done);
          }
        });
      });

      // Needs general refactoring
      // See https://github.com/webpack/webpack/issues/8830 and
      // https://github.com/cyrilfretlink/try-purescript-react-basic/blob/e7bc08f83e72b6dee99ec18fab332223492d6aca/purs-css-modules-webpack-plugin/src/index.js
      // compilation.hooks.finishModules.tap(PLUGIN_NAME, (...args) => {
      //   console.warn('finishModules', args);
      // });

      // There is probably a better way to do this, but there is almost no documentation 🤷‍♂️
//       compilation.hooks.optimizeChunkAssets.tap(PLUGIN_NAME, (chunks) => {
//         console.warn('optimizeChunkAssets');
//         const replacements = Array.from(this.seeds.keys());
//         if (!replacements.length) return;
//
//         debug('attempting to find patterns to replace');
//
//         chunks.forEach((chunk) => {
//           chunk.files.forEach((filePath) => {
//             // No need to check sources of images/css/whatever
//             if (!REGEX_JSFILE.test(filePath)) return;
//
//             const asset = compilation.assets[filePath];
//             const source = asset.source();
//
//             replacements.forEach((id) => {
//               // Slightly ugly because have to work around the JSONParser from Webpack 🤷‍♂️
//
//               const pattern = getSeedPattern(id);
//               const index = source.indexOf(pattern);
//
//               if (index < 0) return;
//
//               const content = JSON.stringify(this.getDictionary(id), null, 2);
//               const updatedSource = new ReplaceSource(asset);
//
//               updatedSource.replace(index, index + pattern.length, content);
//               compilation.updateAsset(filePath, updatedSource);
//               debug('injected content into %s', filePath);
//             });
//           });
//         });
//       });
    });

    compiler.hooks.emit.tapAsync(PLUGIN_NAME, (compilation, callback) => {
      debug('building dictionaries');

      Array.from(this.seeds.keys()).forEach((id) => {
        const { language } = this.seeds.get(id);
        const filePath = getOutputPath(outputPattern, language);

        // Webpack is unable to save assets to absolute paths, a relative to the output folder
        // must be provided. 🤷‍♂️
        const relativePath = path.relative(compilerOutputPath, filePath);
        const content = JSON.stringify(this.getDictionary(id), null, 2);

        compilation.assets[relativePath] = {
          source: () => content,
          size: () => content.length,
        };

        debug('saved %s locale to %s', language, filePath);
      });

      callback();
    });
  }
}

module.exports = I18nModularPlugin;
