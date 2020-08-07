# 1.1.0
 - Added preview scripts to improve build testing for both webpack and sync binary
 - Improved sorting of module keys
 - Resolved issues with some of the `devtool` options breaking build
 - Resolved issues with `context` option breaking build
 - Resolved issues with incorrectly calculating size of the output chunks
 - Resolved an issue with cache of the chunk not changing when translations change
 - Made `i18n-modular update` not depend on reverse-creating file paths from keys. `i18n-modular update` will not create new modules anymore.
 - Added module loader to exports in case only remapping of keys is necessary
 - Moved module id generation logic from the plugin into the loader, now module loader can work independently from the plugin
 - Added new "emitFile" option, when set to `false` will not emit updated dictionary files
 - ~Resolved an issue where removing a module from compilation during watch mode wouldn't remove it from the resulting dictionary~ Still an issue!
 - Added support for `I18N_MODULAR_CONTEXT` env variable, useful for matching webpack and `i18n-modular` binary contexts and for locating RC file.
 - Fixed an issue with size of a dictionary containing emojis not calculating properly

# 1.0.2
 - Resolved an issue with inconsistent sorting of dictionary keys

# 1.0.0
First release
