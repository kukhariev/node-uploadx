import * as fs from 'fs';
import * as rimraf from 'rimraf';
import * as utils from '../src';
const ROOT = `./upload/fs-test`;
const DIR = `${ROOT}/1/2`;
const FILE = `${DIR}/3/file.ext`;

describe('fs ensure*', () => {
  beforeEach(() => {
    rimraf.sync(ROOT);
  });
  afterAll(() => {
    rimraf.sync(ROOT);
  });
  it('should create directory `ensureDir()`', async () => {
    await utils.ensureDir(DIR);
    expect(fs.existsSync(DIR)).toBe(true);
  });

  it('should create file or/end return size `ensureFile()`', async () => {
    const size = await utils.ensureFile(FILE);
    expect(fs.existsSync(FILE)).toBe(true);
    expect(size).toBe(0);
  });
});

describe('typeis', () => {
  const mime = 'application/vnd+json';
  const headers = { headers: { 'content-type': mime } } as any;

  it('typeis()', () => {
    expect(utils.typeis({ headers: {} } as any, ['json'])).toBe(false);
    expect(utils.typeis(headers, ['html'])).toBe(false);
    expect(utils.typeis(headers, ['json'])).toBe(mime);
  });

  it('typeis.is()', () => {
    expect(utils.typeis.is(mime, ['application/vnd+json'])).toBe(mime);
    expect(utils.typeis.is(mime, ['vnd+json'])).toBe(mime);
    expect(utils.typeis.is(mime, ['application/*'])).toBe(mime);
    expect(utils.typeis.is(mime, ['json', 'xml'])).toBe(mime);
    expect(utils.typeis.is(mime, ['*/*'])).toBe(mime);
  });
});

describe('getHeader', () => {
  let req: any;
  it('empty', () => {
    const res = utils.getHeader(req, 'origin');
    expect(res).toBe('');
  });

  it('string', () => {
    req = { headers: { head: 'value' } };
    const res = utils.getHeader(req, 'head');
    expect(res).toBe('value');
  });

  it('array', () => {
    req = { headers: { head: ['value1', 'value2'] } };
    const res = utils.getHeader(req, 'head');
    expect(res).toBe('value1');
  });
});

describe('getFiles', () => {
  it('file', async () => {
    const files = await utils.getFiles('test/server/testfile.mp4');
    expect(files.length).toBe(1);
  });

  it('directory', async () => {
    const files = await utils.getFiles('test/server');
    expect(files.length).toBeGreaterThan(1);
  });

  it('empty', async () => {
    const files = await utils.getFiles('test/notfound');
    expect(files.length).toBe(0);
  });
});
