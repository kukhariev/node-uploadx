import { expect } from 'chai';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as rimraf from 'rimraf';
import * as utils from '../src/utils';

describe('utils', function() {
  describe('fs', function() {
    const ROOT = `${tmpdir()}/node-uploadx`;
    const DIR = `${ROOT}/1/2`;
    const FILE = `${DIR}/3/file.ext`;
    const REL = './tmp/1/2';

    beforeEach(() => rimraf.sync(ROOT));

    it('ensureDir(absolute path)', async function() {
      await utils.ensureDir(DIR);
      expect(fs.existsSync(DIR)).to.be.true;
    });
    it('ensureFile(absolute path)', async function() {
      const size = await utils.ensureFile(FILE);
      expect(fs.existsSync(FILE)).to.be.true;
      expect(size).to.be.equal(0);
    });
    it('ensureDir(relative path)', async function() {
      await utils.ensureDir(REL);
      expect(fs.existsSync(REL)).to.be.true;
    });

    after(() => rimraf.sync(ROOT));
  });

  describe('isObject', function() {
    it('{}', () => {
      expect(utils.isObject({})).to.be.true;
    });
    it('null', () => {
      expect(utils.isObject(null)).to.be.false;
    });
    it('Buffer', () => {
      expect(utils.isObject(Buffer.from('buffer'))).to.be.false;
    });
  });
  describe('is', function() {
    it('no content-type', () => {
      expect(utils.is({ headers: {} } as any, ['json'])).to.be.false;
    });

    it('json', () => {
      expect(
        utils.is({ headers: { 'content-type': 'application/json' } } as any, ['json'])
      ).to.be.equal('application/json');
    });
    it('multi', () => {
      expect(
        utils.is({ headers: { 'content-type': 'application/json' } } as any, ['xml', 'json'])
      ).to.be.equal('application/json');
    });
    describe('is.is', () => {
      it('video/mp4', function() {
        expect(utils.is.is('video/mp4', ['video'])).to.be.equal('video/mp4');
      });
      it('*/*', function() {
        expect(utils.is.is('video/mp4', ['*/*'])).to.be.equal('video/mp4');
      });
    });
  });

  describe('toHeaderString', () => {
    it('string', () => {
      expect(utils.toHeaderString('string')).to.be.equal('string');
    });
    it('number', () => {
      expect(utils.toHeaderString(10)).to.be.equal('10');
    });
    it('boolean', () => {
      expect(utils.toHeaderString(true)).to.be.equal('true');
    });
    it('undefined', () => {
      expect(utils.toHeaderString(undefined)).to.be.undefined;
    });
    it('string[]', () => {
      expect(utils.toHeaderString(['post', 'patch'])).to.be.equal('post,patch');
    });
  });
});
