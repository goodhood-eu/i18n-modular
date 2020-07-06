const { assert } = require('chai');

const {
  getOptions,
  getModuleId,
  reverseModuleId,
  getOutputPattern,
  getDictionaryRegex,
  getOutputPath,
  getLanguage,
  getSeedPattern,
  getCleanGenerated,
  getCleanSeed,
  getSortedObject,
  getDeepSortedObject,
} = require('./utils');


describe('utils', () => {
  it('getOptions', () => {
    assert.isObject(getOptions(), 'returns an object');
  });

  it('getModuleId', () => {
    const path = '/project/subfolder/a/b/c/module.with.lots.of.dots.whatever.json';
    const root = '/project';
    const ending = 'whatever.json';
    assert.include(getModuleId(path, root, ending), 'module', 'contains module name');
    assert.notInclude(getModuleId(path, root, ending), '.', 'no dots');
    assert.notInclude(getModuleId(path, root, ending), 'project', 'rebased');
    assert.notInclude(getModuleId(path, root, ending), 'whatever', 'removed ending');
  });

  it('reverseModuleId', () => {
    const path = '/project/subfolder/a/b/c/module.with.lots.of.dots.whatever.json';

    const root = '/project';
    const ending = 'whatever.json';
    const id = getModuleId(path, root, ending);

    assert.equal(reverseModuleId(id, root, ending), path, 'reversed path fully');
  });

  it('getOutputPattern', () => {
    const path = '/whatever/bloomer/myfile-[locale_code].json';

    assert.isNull(getOutputPattern(), 'empty call');
    assert.include(getOutputPattern('/whatever'), '[locale_code].json', 'passed a folder, a proper path out');
    assert.equal(getOutputPattern(path), path, 'doesn\'t modify correct paths');
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

  it('getSeedPattern', () => {
    const path = 'STRING';
    assert.include(getSeedPattern(path), path, 'include original value');
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
    const obj = {
      a: 1,
      a_b: 2,
      ab_c: 3,
      abc: 4,
    };

    const expected = { a: 1, abc: 4, ab_c: 3, a_b: 2 };

    const deepObj = {
      deep: obj,
      a: 1,
      a_b: 2,
      ab_c: 3,
      abc: 4,
    };

    const deepExpected = { a: 1, abc: 4, ab_c: 3, a_b: 2, deep: expected };

    assert.deepEqual(getSortedObject(obj), expected, 'sorts keys properly');
    assert.deepEqual(getSortedObject(deepObj, true), deepExpected, 'sorts deep keys properly');
  });

  it('getDeepSortedObject', () => {
    const obj = {
      a: 1,
      a_b: 2,
      ab_c: 3,
      abc: 4,
    };

    const expected = { a: 1, abc: 4, ab_c: 3, a_b: 2 };

    const deepObj = {
      deep: obj,
      a: 1,
      a_b: 2,
      ab_c: 3,
      abc: 4,
    };

    const deepExpected = { a: 1, abc: 4, ab_c: 3, a_b: 2, deep: expected };

    assert.deepEqual(getDeepSortedObject(deepObj), deepExpected, 'sorts deep keys properly');
  });
});
