# 1.1.0
 - Improved sorting of module keys
 - Resolved issues with certain `devtool` options breaking build
 - Resolved issues with `context` option breaking build
 - Resolved issues with incorrectly calculating size of output chunks
 - Resolved issue with cache of the chunk not changing when translations change
 - Made updating modules independent from module IDs
 - Added module loader to exports in case only remapping is needed
 - Moved all id generation option from plugin into the loader, now loader can work independently
 - Added new "emitFile" option, when set to `false` will not emit updated dictionary files

# 1.0.2
 - Resolved an issue with inconsistent sorting of dictionary keys

# 1.0.0
First release
