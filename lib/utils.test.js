const { assert } = require('chai');

const {
  rebase,
  getContext,
  getOptions,
  getModuleId,
  getDictionaryRegex,
  getLanguage,
  getCleanGenerated,
  getCleanSeed,
  getSortedObject,
  getDeepSortedObject,
  storeTranslationModules,
  getTranslationModules,
  collectModules,
} = require('./utils');

const getRandomlySortedObject = (source) => (
  Object.keys(source)
    .sort(() => (Math.random() > .5 ? 1 : -1))
    .reduce((acc, key) => {
      acc[key] = source[key];
      return acc;
    }, {})
);

const runCallbackTimesSync = (fn, times = 100) => {
  for (let i = 0; i < times; i += 1) fn();
};


describe('utils', () => {
  it('rebase', () => {
    assert.equal(rebase(), process.cwd(), 'empty call');
    assert.equal(rebase('/abc'), '/abc', 'file defaults to .');
    assert.equal(rebase('/abc', '/def'), '/def', 'absolute path');
    assert.equal(rebase('/abc', './def'), '/abc/def', 'relative path');
    assert.equal(rebase('/abc', 'def'), '/abc/def', 'no . but a relative path');
  });

  it('getContext', () => {
    assert.isString(getContext(), 'returns a string');

    const context = './subfolder';
    process.env.I18N_MODULAR_CONTEXT = context;
    assert.isTrue(getContext().endsWith(context.slice(1)), 'contains context');
  });

  it('getOptions', () => {
    const result = getOptions();

    assert.isObject(result, 'returns an object');
    assert.isString(result.keysRoot, 'keysRoot set');
    assert.isString(result.moduleEnding, 'moduleEnding set');
  });

  it('getModuleId', () => {
    const path = '/project/subfolder/a/b/c/module.with.lots.of.dots.whatever.json';
    const root = '/project';
    const ending = 'whatever.json';
    const result = getModuleId(root, ending, path);

    assert.include(result, 'module', 'contains module name');
    assert.isFalse(result.startsWith('/'), 'removed leading slash');
    assert.notInclude(result, '.', 'no dots');
    assert.notInclude(result, 'project', 'rebased');
    assert.notInclude(result, 'whatever', 'removed ending');
  });

  it('getDictionaryRegex', () => {
    const path = '/whatever/bloomer/myfile-[locale_code].json';
    const expected = '/whatever/bloomer/myfile-de-DE.json';

    const result = getDictionaryRegex(path);

    assert.typeOf(result, 'regexp', 'returns correct type');
    assert.isTrue(result.test(expected), 'matches itself');
    assert.isFalse(result.test(`${expected}.bson`), 'wrong match not triggered');
    assert.isFalse(result.test(expected.replace('.json', '.bson')), 'wrong extension not triggered');
  });

  it('getLanguage', () => {
    const path = '/whatever/bloomer/myfile-de-DE-great-stuff-ok-SIR.json';
    assert.equal(getLanguage(path), 'de-DE', 'correct language detection');
  });

  it('getCleanSeed', () => {
    const dirty = {
      a: 1,
      b: 2,
      'module:a/b/c': 3,
      'module:d/e/f': 4,
      'd/e/f': 5,
    };

    const clean = {
      a: 1,
      b: 2,
      'd/e/f': 5,
    };

    assert.deepEqual(getCleanSeed(dirty), clean, 'removed generated keys');
  });

  it('getCleanGenerated', () => {
    const dirty = {
      a: 1,
      b: 2,
      'module:a/b/c': 3,
      'module:d/e/f': 4,
      'd/e/f': 5,
    };

    const clean = {
      'module:a/b/c': 3,
      'module:d/e/f': 4,
    };

    assert.deepEqual(getCleanGenerated(dirty), clean, 'only left generated keys');
  });

  it('getSortedObject', () => {
    runCallbackTimesSync(() => {
      const obj = getRandomlySortedObject({
        a: 1,
        a_1: 1,
        a_b: 1,
        ab_c: 1,
        abc_1: 1,
        abc: 1,
      });

      const expected = { a: 1, abc: 1, abc_1: 1, ab_c: 1, a_1: 1, a_b: 1 };

      const deepObj = getRandomlySortedObject({
        deep: obj,
        a: 1,
        a_b: 1,
        ab_c: 1,
        abc: 1,
      });


      assert.deepEqual(Object.keys(getSortedObject(obj)), Object.keys(expected), 'sorts keys properly');
      assert.deepEqual(Object.keys(getSortedObject(deepObj, true).deep), Object.keys(expected), 'sorts deep keys properly');
    });
  });

  it('getDeepSortedObject', () => {
    runCallbackTimesSync(() => {
      const obj = getRandomlySortedObject({
        a: 1,
        a_1: 1,
        a_b: 1,
        ab_c: 1,
        abc_1: 1,
        abc: 1,
      });

      const expected = { a: 1, abc: 1, abc_1: 1, ab_c: 1, a_1: 1, a_b: 1 };

      const deepObj = getRandomlySortedObject({
        deep: obj,
        a: 1,
        a_b: 1,
        ab_c: 1,
        abc: 1,
      });

      assert.deepEqual(Object.keys(getDeepSortedObject(deepObj).deep), Object.keys(expected), 'sorts deep keys properly');
    });
  });

  it('getTranslationModules', () => {
    const webpackModule = {};
    const content = 'something anything really';

    assert.isUndefined(getTranslationModules(), 'empty call');
    assert.isUndefined(getTranslationModules(webpackModule), 'empty module');

    storeTranslationModules(webpackModule, content);
    assert.equal(getTranslationModules(webpackModule), content, 'extracted content properly');
  });

  it('storeTranslationModules', () => {
    const content = 'something anything really';
    const webpackModule = {};
    assert.isObject(storeTranslationModules(), 'empty call');
    assert.isObject(storeTranslationModules({}), 'empty module');

    storeTranslationModules(webpackModule, content);
    assert.equal(getTranslationModules(webpackModule), content, 'set content properly');
  });

  it('collectModules', () => {
    const map = new Map([
      ['module:1', { 'de-DE': { hello: 'Sei gegrüßt!' }, 'en-US': { hello: 'Howdy' } }],
      ['module:2', { 'de-DE': { how_are_you: 'Wie läuft\'s Brudi?' }, 'en-US': { how_are_you: 'Waaazaaaaaap?!' } }],
    ]);

    const expected = { 'module:1': { hello: 'Sei gegrüßt!' }, 'module:2': { how_are_you: 'Wie läuft\'s Brudi?' } };

    assert.deepEqual(collectModules(map, 'de-DE'), expected, 'collected module values properly');
  });
});
