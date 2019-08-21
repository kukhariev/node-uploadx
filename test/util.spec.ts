import { expect } from 'chai';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as rimraf from 'rimraf';
import * as utils from '../src/utils';
const ROOT = `${tmpdir()}/fs-test`;
const DIR = `${ROOT}/1/2`;
const FILE = `${DIR}/3/file.ext`;
describe('Utils', function() {
  describe('fs ensure*', function() {
    beforeEach(function() {
      rimraf.sync(ROOT);
    });
    it('should create directory `ensureDir()`', async function() {
      await utils.ensureDir(DIR);
      expect(fs.existsSync(DIR)).to.be.true;
    });
    it('should create file or/end return size `ensureFile()`', async function() {
      const size = await utils.ensureFile(FILE);
      expect(fs.existsSync(FILE)).to.be.true;
      expect(size).to.be.equal(0);
    });

    after(function() {
      rimraf.sync(ROOT);
    });
  });

  describe('isObject', function() {
    it('should return true isObject({})', function() {
      expect(utils.isObject({})).to.be.true;
    });
    it('should return true isObject(null)', function() {
      expect(utils.isObject(null)).to.be.false;
    });
    it('should return true isObject(v: Buffer)', function() {
      expect(utils.isObject(Buffer.from('buffer'))).to.be.false;
    });
  });
  describe('typeis', function() {
    it('no content-type', function() {
      expect(utils.typeis({ headers: {} } as any, ['json'])).to.be.false;
    });

    it('json', function() {
      expect(
        utils.typeis({ headers: { 'content-type': 'application/json' } } as any, ['json'])
      ).to.be.equal('application/json');
    });
    it('multi', function() {
      expect(
        utils.typeis({ headers: { 'content-type': 'application/json' } } as any, ['xml', 'json'])
      ).to.be.equal('application/json');
    });
    describe('typeis.is', function() {
      it('video/mp4', function() {
        expect(utils.typeis.is('video/mp4', ['video'])).to.be.equal('video/mp4');
      });
      it('*/*', function() {
        expect(utils.typeis.is('video/mp4', ['*/*'])).to.be.equal('video/mp4');
      });
    });
  });

  describe('toHeaderString', function() {
    it('string', function() {
      expect(utils.toHeaderString('string')).to.be.equal('string');
    });
    it('number', function() {
      expect(utils.toHeaderString(10)).to.be.equal('10');
    });
    it('boolean', function() {
      expect(utils.toHeaderString(true)).to.be.equal('true');
    });
    it('undefined', function() {
      expect(utils.toHeaderString(undefined)).to.be.undefined;
    });
    it('string[]', function() {
      expect(utils.toHeaderString(['post', 'patch'])).to.be.equal('post,patch');
    });
  });
});
