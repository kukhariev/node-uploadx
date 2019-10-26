import { expect } from 'chai';
import { rangeParser } from '../src';
describe('Content-Range parser', function() {
  it('should parse `resume` ranges', function() {
    const samples = [undefined, '', 'bytes */*', 'bytes */7777777', 'bytes --1/*'];
    samples.forEach(sample => {
      const res = rangeParser(sample);
      expect(res.start).to.satisfy((v: number) => Number.isNaN(v));
    });
  });
  it('should parse `write` ranges', function() {
    const samples = [
      'bytes 0-*/7777777',
      'bytes 0-333333/7777777',
      'bytes 0-*/*',
      'bytes 4000-*/7777777',
      'bytes 0--1/*'
    ];
    samples.forEach(sample => {
      const res = rangeParser(sample);
      expect(res.start).to.satisfy((v: number) => Number.isInteger(v));
    });
  });
});
