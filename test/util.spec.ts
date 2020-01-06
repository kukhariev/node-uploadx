import * as fs from 'fs';
import * as rimraf from 'rimraf';
import * as utils from '../src';
const ROOT = `./upload/fs-test`;
const DIR = `${ROOT}/1/2`;
const FILE = `${DIR}/3/file.ext`;

describe('fs ensure*', function() {
  beforeEach(function() {
    rimraf.sync(ROOT);
  });
  afterAll(function() {
    rimraf.sync(ROOT);
  });
  it('should create directory `ensureDir()`', async function() {
    await utils.ensureDir(DIR);
    expect(fs.existsSync(DIR)).toBe(true);
  });

  it('should create file or/end return size `ensureFile()`', async function() {
    const size = await utils.ensureFile(FILE);
    expect(fs.existsSync(FILE)).toBe(true);
    expect(size).toBe(0);
  });
});

describe('typeis', function() {
  const mime = 'application/vnd+json';
  const headers = { headers: { 'content-type': mime } } as any;

  it('typeis()', function() {
    expect(utils.typeis({ headers: {} } as any, ['json'])).toBe(false);
    expect(utils.typeis(headers, ['html'])).toBe(false);
    expect(utils.typeis(headers, ['json'])).toBe(mime);
  });

  it('typeis.is()', function() {
    expect(utils.typeis.is(mime, ['application/vnd+json'])).toBe(mime);
    expect(utils.typeis.is(mime, ['vnd+json'])).toBe(mime);
    expect(utils.typeis.is(mime, ['application/*'])).toBe(mime);
    expect(utils.typeis.is(mime, ['json', 'xml'])).toBe(mime);
    expect(utils.typeis.is(mime, ['*/*'])).toBe(mime);
  });
});

describe('getHeader', function() {
  let req: any;
  it('empty', function() {
    const res = utils.getHeader(req, 'origin');
    expect(res).toBe('');
  });

  it('string', function() {
    req = { headers: { head: 'value' } };
    const res = utils.getHeader(req, 'head');
    expect(res).toBe('value');
  });

  it('array', function() {
    req = { headers: { head: ['value1', 'value2'] } };
    const res = utils.getHeader(req, 'head');
    expect(res).toBe('value1');
  });
});

describe('getFiles', function() {
  it('file', async function() {
    const files = await utils.getFiles('test/server/testfile.mp4');
    expect(files.length).toBe(1);
  });

  it('directory', async function() {
    const files = await utils.getFiles('test/server');
    expect(files.length).toBeGreaterThan(1);
  });

  it('empty', async function() {
    const files = await utils.getFiles('test/notfound');
    expect(files.length).toBe(0);
  });
});
