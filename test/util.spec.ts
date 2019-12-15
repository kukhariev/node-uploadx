import { expect } from 'chai';
import * as fs from 'fs';
import * as rimraf from 'rimraf';
import * as utils from '../src';
import { getFiles } from '../src';
const ROOT = `./upload/fs-test`;
const DIR = `${ROOT}/1/2`;
const FILE = `${DIR}/3/file.ext`;

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

describe('typeis', function() {
  const mime = 'application/vnd+json';
  const headers = { headers: { 'content-type': mime } } as any;

  it('typeis()', function() {
    expect(utils.typeis({ headers: {} } as any, ['json'])).to.be.false;
    expect(utils.typeis(headers, ['html'])).to.be.false;
    expect(utils.typeis(headers, ['json'])).to.be.equal(mime);
  });

  it('typeis.is()', function() {
    expect(utils.typeis.is(mime, ['application/vnd+json'])).to.be.equal(mime);
    expect(utils.typeis.is(mime, ['vnd+json'])).to.be.equal(mime);
    expect(utils.typeis.is(mime, ['application/*'])).to.be.equal(mime);
    expect(utils.typeis.is(mime, ['json', 'xml'])).to.be.equal(mime);
    expect(utils.typeis.is(mime, ['*/*'])).to.be.equal(mime);
  });
});

describe('getFiles', function() {
  it('file', async function() {
    const files = await getFiles('test/testfile.mp4');
    expect(files.length).to.be.eq(1);
  });

  it('directory', async function() {
    const files = await getFiles('test');
    expect(files.length).to.be.gt(1);
  });

  it('empty', async function() {
    const files = await getFiles('test/notfinded');
    expect(files.length).to.be.eq(0);
  });
});
