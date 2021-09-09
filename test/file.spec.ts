import { FileName } from '../packages/core/src/storages/';

describe('File', () => {
  describe('FileName', () => {
    it.each([
      ['', false],
      ['..', false],
      ['c:\\abs', false],
      ['12', false],
      ['filename?.ext', false],
      ['../filename.ext', false],
      ['/filename.ext', false],
      ['filename.ext', true]
    ])('isValid(%s) === %s', (str, expected) => {
      expect(FileName.isValid(str)).toBe(expected);
    });
  });
});
