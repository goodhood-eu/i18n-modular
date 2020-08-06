const { assert } = require('chai');

const {
  getOptions,
  getModuleId,
  getDictionaryRegex,
  getOutputPath,
  getLanguage,
  getCleanGenerated,
  getCleanSeed,
  getSortedObject,
  getDeepSortedObject,
  setModuleTranslations,
  getModuleTranslations,
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
  it('getOptions', () => {
    assert.isObject(getOptions(), 'returns an object');
  });

  it('getModuleId', () => {
    const path = '/project/subfolder/a/b/c/module.with.lots.of.dots.whatever.json';
    const root = '/project';
    const ending = 'whatever.json';
    assert.include(getModuleId(root, ending, path), 'module', 'contains module name');
    assert.notInclude(getModuleId(root, ending, path), '.', 'no dots');
    assert.notInclude(getModuleId(root, ending, path), 'project', 'rebased');
    assert.notInclude(getModuleId(root, ending, path), 'whatever', 'removed ending');
  });

  it('getDictionaryRegex', () => {
    const path = '/whatever/bloomer/myfile-[locale_code].json';
    const expected = '/whatever/bloomer/myfile-de-DE.json';

    assert.typeOf(getDictionaryRegex(path), 'regexp', 'returns correct type');
    assert.isTrue(getDictionaryRegex(path).test(expected), 'matches itself');
    assert.isFalse(getDictionaryRegex(path).test(`${expected}.bson`), 'wrong match not triggered');
  });

  it('getOutputPath', () => {
    const path = '/whatever/bloomer/myfile-[locale_code].json';
    const expected = '/whatever/bloomer/myfile-de-DE.json';

    assert.equal(getOutputPath(path, 'de-DE'), expected, 'correct output path');
  });

  it('getLanguage', () => {
    const path = '/whatever/bloomer/myfile-de-DE.json';
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

  it('getModuleTranslations', () => {
    const webpackModule = {};
    const content = 'something anything really';

    assert.isUndefined(getModuleTranslations(), 'empty call');
    assert.isUndefined(getModuleTranslations(webpackModule), 'empty module');

    setModuleTranslations(webpackModule, content);
    assert.equal(getModuleTranslations(webpackModule), content, 'extracted content properly');
  });

  it('setModuleTranslations', () => {
    const content = 'something anything really';
    const webpackModule = {};
    assert.isObject(setModuleTranslations(), 'empty call');
    assert.isObject(setModuleTranslations({}), 'empty module');

    setModuleTranslations(webpackModule, content);
    assert.equal(getModuleTranslations(webpackModule), content, 'set content properly');
  });
});
