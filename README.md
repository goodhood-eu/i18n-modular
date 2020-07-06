i18n-modular
============

A webpack plugin that brings support for a modular approach to working with dictionaries. Especially useful for tools such as [Phraseapp](https://phrase.com). Same as CSS Modules, but for i18n.

## Usage:

In your webpack config:
```javascript
const I18nModular = require('i18n-modular');
//...
plugins: [
  new I18nModular(),
],
```

Create an options RC file in your project's root named `.i18n-modular-rc.js` with this example content:
```javascript
module.exports = {
  // Opional, your keys will be relative to this folder, usually `./app` or `./client`
  keysRoot: './',
  // Opional, how you will be naming your translation modules, similar to name.module.css
  moduleEnding: '.translations.json',

  // Usually the same as the location in phraseapp.yml
  // the path to your dictionary folder or files with [locale_code]
  // to be replaced with the language name.
  dictionaryPattern: './dictionaries/[locale_code].json',
};
```

If you don't expect to use the CLI (see below), then instead of creating an RC file you
can simply pass an options object as an argument to the plugin.

## Options:

 - `keysRoot` (optional) - the keys will be generated relative to this folder. Use this to make generated keys shorter by excluding static parts of the path, e.g. if all your translations are in `./frontend/app/components` pass that as the `keysRoot`. Defaults to `process.cwd()`
 - `moduleEnding` (optional) - the ending that will be used for the translation modules. You can't use `:` symbol in file names for these files. It's an OS limitation for MacOS and Windows anyway, but *nix users should be aware. Defaults to `'.translations.json'`
 - `dictionaryPattern` (required) - the path to your dictionary folder or files. Use `[locale_code]` placeholder to get current language name injected into the file name. Try not to name your dictionaries in such a way where part of the name might be confused for a language name. For example this might break the build `./dicts/gr-EAT.[locale_code].json`

## CLI:

This package comes with a CLI because you need a way to sync updates from Phraseapp or translations hosting service back into your modules and a simple way to build all languages from modules at once. To use this CLI you must create an RC configuration file.

 - `npx i18n-modular build` will build all dictionaries from modules
 - `npx i18n-modular update` will update all modules from dictionaries
 - `npx i18n-modular clean` will remove all generated modules from dictionaries

### An example with Phraseapp CLI:

 - `npx i18n-modular build && phraseapp push` will push all generated modules to phraseapp
 - `phraseapp pull && npx i18n-modular update` will update all modules with changes from phraseapp

## Debugging

This module uses [debug](https://github.com/visionmedia/debug) internally with this label `i18n_modular`. To debug use DEBUG=i18n_modular in your env: `DEBUG=i18n_modular npx webpack`.
