import * as chai from 'chai';
import 'mocha';
import { rangeParser } from '../src/handler';
const expect = chai.expect;

describe('content-range parser', function() {
  it('resume', function(done) {
    const samples = [undefined, '', 'bytes */*', 'bytes */7777777', 'bytes --1/*'];
    samples.forEach(sample => {
      const res = rangeParser(sample);
      expect(res.start).to.satisfy(Number.isNaN);
    });
    done();
  });
  it('write', function(done) {
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
    done();
  });
});
