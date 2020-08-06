#!/usr/bin/env node

const chalk = require('chalk');
const validate = require('schema-utils');

const { debug, rebase, getContext, getOptions } = require('../lib/utils');

const schema = require('../lib/schema');
const actions = require('../lib/sync');

const context = getContext();

const options = ['keysRoot', 'dictionaryPattern'].reduce((acc, key) => {
  acc[key] = rebase(context, acc[key]);
  return acc;
}, getOptions());

validate(schema, options, { name: 'I18nModular CLI' });

debug('initialized the CLI with options %O', options);

const getElapsed = (timestamp) => ((Date.now() - timestamp) / 1000).toFixed(2);

const successExit = (message) => {
  console.log(chalk.green(message));
  process.exit(0);
};

const errorExit = (message) => {
  console.error(chalk.bold.red(message));
  process.exit(1);
};

const [name] = process.argv.slice(2);
if (!name) errorExit(`A command name is required. Possible commands: ${Object.keys(actions).join(', ')}`);

const fn = actions[name];
if (!fn) errorExit(`Command ${name} is not supported`);

const time = fn(options);
successExit(`Completed "${name}" in ${getElapsed(time)}s`);
