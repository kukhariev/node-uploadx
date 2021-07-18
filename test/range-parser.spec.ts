import { rangeParser } from '../packages/core/src';

describe('Content-Range parser', () => {
  it('should parse `resume` ranges', () => {
    const samples = [undefined, '', 'bytes */*', 'bytes */7777777', 'bytes --1/*'];
    samples.forEach(sample => {
      const res = rangeParser(sample);
      expect(res.start).toBeNaN();
    });
  });

  it('should parse `write` ranges', () => {
    const samples = [
      'bytes 0-*/7777777',
      'bytes 0-333333/7777777',
      'bytes 0-*/*',
      'bytes 4000-*/7777777',
      'bytes 0--1/*'
    ];
    samples.forEach(sample => {
      const res = rangeParser(sample);
      expect(res.start).toBeGreaterThanOrEqual(0);
    });
  });
});
