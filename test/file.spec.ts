import { FileName } from '../packages/core/src';

describe('File', () => {
  describe('FileName', () => {
    it.each([
      ['', false],
      ['.', false],
      ['..', false],
      ['c:\\abs', false],
      ['1', true],
      ['filename?.ext', false],
      ['../filename.ext', false],
      ['/filename.ext', false],
      ['filename.ext', true],
      ['.filename', true],
      ['file..ext', true],
      ['foo/bar', true]
    ])('isValid(%s) === %s', (str, expected) => {
      expect(FileName.isValid(str)).toBe(expected);
    });

    it.each([
      ['null byte', '\0'],
      ['newline', '\n'],
      ['tab', '\t'],
      ['carriage return', '\r'],
      ['DEL', '\x7F'],
      ['safe\\n.txt', 'safe\n.txt'],
      ['safe\\x7F.txt', 'safe\x7F.txt']
    ])('rejects %s', (_, input) => {
      expect(FileName.isValid(input)).toBe(false);
    });
  });
});
