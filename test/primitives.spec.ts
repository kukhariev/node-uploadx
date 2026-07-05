import * as utils from '../packages/core/src';

describe('primitives', () => {
  it('fnv', () => {
    expect(utils.fnv('123456')).toBe('9995b6aa');
    expect(utils.fnv('спутник')).toBe('5e1edd8c');
  });

  it('fnv64', () => {
    expect(utils.fnv64('123456')).toBe('f6e3ed7e0e67290a');
    expect(utils.fnv64('спутник')).toBe('6251be44251f6e2c');
  });

  it('pick', () => {
    expect(utils.pick({ test: 'test', rest: 'rest' }, ['test'])).toMatchObject({
      test: 'test'
    });
  });

  it('isEqual', () => {
    expect(utils.isEqual({ a: 1, b: 2 }, undefined)).toBe(false);
    expect(utils.isEqual(undefined, undefined)).toBe(false);
    expect(utils.isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(utils.isEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 })).toBe(false);
    expect(utils.isEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }, 'c')).toBe(true);
    expect(utils.isEqual({ a: 1, b: 2, c: { k: 3 } }, { a: 1, b: 2, c: { k: 3 } })).toBe(true);
    expect(utils.isEqual({ a: 1, b: 2, c: { k: 3 } }, { a: 1, b: 2, c: { k: 4 } })).toBe(false);
    expect(utils.isEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('memoize', () => {
    const md5Cached = utils.memoize(utils.md5);
    const fnvCached = utils.memoize(utils.fnv);
    expect(md5Cached('123456')).toBe('e10adc3949ba59abbe56e057f20f883e');
    expect(fnvCached('123456')).toBe('9995b6aa');
  });

  it('extendObject', () => {
    expect(utils.extendObject<object>({ a: 1 }, { a: { b: 1 }, c: null })).toEqual({
      a: { b: 1 },
      c: null
    });
    expect(utils.extendObject<object>({ a: 1, c: [4] }, { a: { b: 1 }, c: [1, 2, 3] })).toEqual({
      a: { b: 1 },
      c: [1, 2, 3]
    });
  });

  describe('Duration Conversion', () => {
    const durationToMs = utils.durationToMs;

    it('should convert ms', () => {
      expect(durationToMs('500')).toBe(500);
    });

    it('should convert single unit durations', () => {
      expect(durationToMs('5s')).toBe(5000);
      expect(durationToMs('10m')).toBe(600000);
      expect(durationToMs('2h')).toBe(7200000);
      expect(durationToMs('3d')).toBe(259200000);
    });

    it('should convert multiple unit durations', () => {
      expect(durationToMs('1h 30m')).toBe(5400000);
      expect(durationToMs('2d 4h 30m')).toBe(189000000);
      expect(durationToMs('1w 2d 3h')).toBe(788400000);
    });

    it('should handle full word units', () => {
      expect(durationToMs('5 seconds')).toBe(5000);
      expect(durationToMs('2 hours')).toBe(7200000);
      expect(durationToMs('1 day 12 hours')).toBe(129600000);
    });

    it('should throw error for invalid units', () => {
      expect(() => durationToMs('5x')).toThrow('Invalid time unit: x');
      expect(() => durationToMs('10 invalid')).toThrow('Invalid time unit: invalid');
    });

    it('should throw error for invalid format', () => {
      expect(() => durationToMs('abc')).toThrow('Invalid duration format');
      expect(() => durationToMs('')).toThrow('Invalid duration format');
    });

    it('should throw error for excessive input length', () => {
      const longInput = '1s '.repeat(17);
      expect(() => durationToMs(longInput)).toThrow('Input string exceeds maximum length');
    });

    it('should convert to milliseconds', () => {
      const toMilliseconds = utils.toMilliseconds;
      expect(toMilliseconds(0)).toBe(0);
      expect(toMilliseconds('0')).toBe(0);
      expect(toMilliseconds(1500)).toBe(1500);
      expect(toMilliseconds('5s')).toBe(5000);
      expect(toMilliseconds(undefined)).toBeUndefined();
      expect(toMilliseconds('')).toBeUndefined();
    });

    it('should convert to seconds', () => {
      const toSeconds = utils.toSeconds;
      expect(toSeconds(0)).toBe(0);
      expect(toSeconds('0')).toBe(0);
      expect(toSeconds(1500)).toBe(1);
      expect(toSeconds('5s')).toBe(5);
      expect(toSeconds(undefined)).toBeUndefined();
      expect(toSeconds('')).toBeUndefined();
    });
  });
});
