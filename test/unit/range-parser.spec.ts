import { expect } from 'chai';
import { rangeParser } from '../../src/uploadx';
describe('content-range parser', function() {
  it('resume', function() {
    const samples = [undefined, '', 'bytes */*', 'bytes */7777777', 'bytes --1/*'];
    samples.forEach(sample => {
      const res = rangeParser(sample);
      expect(res.start).to.satisfy(Number.isNaN);
    });
  });
  it('write', function() {
    const samples = [
      'bytes 0-*/7777777',
      'bytes 0-333333/7777777',
      'bytes 0-*/*',
      'bytes 4000-*/7777777',
      'bytes 0--1/*'
    ];
    samples.forEach(sample => {
      const res = rangeParser(sample);
      expect(res.start).to.satisfy(Number.isInteger);
    });
  });
});
