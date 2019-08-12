import { expect } from 'chai';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as rimraf from 'rimraf';
import * as utils from '../../src/utils';

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
  describe('typeis', function() {
    it('no content-type', () => {
      expect(utils.typeis({ headers: {} } as any, ['json'])).to.be.false;
    });

    it('application/json', () => {
      expect(
        utils.typeis({ headers: { 'content-type': 'application/json' } } as any, ['json'])
      ).to.be.equal('application/json');
    });
    it('multi', () => {
      expect(
        utils.typeis({ headers: { 'content-type': 'application/json' } } as any, ['xml', 'json'])
      ).to.be.equal('application/json');
    });
    describe('typeis.is', () => {
      it('video/mp4', function() {
        expect(utils.typeis.is('video/mp4', ['video'])).to.be.equal('video/mp4');
      });
      it('*/*', function() {
        expect(utils.typeis.is('video/mp4', ['*/*'])).to.be.equal('video/mp4');
      });
    });
  });
});
