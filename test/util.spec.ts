import * as fs from 'fs';
import { IncomingMessage } from 'http';
import * as rimraf from 'rimraf';
import * as utils from '../src/utils';

describe('fs', () => {
  const ROOT = `./upload/fs-test`;
  const DIR = `${ROOT}/1/2`;
  const FILE = `${DIR}/3/file.ext`;

  beforeAll(() => rimraf.sync(ROOT));
  afterAll(() => rimraf.sync(ROOT));

  it('ensureDir(dir)', async () => {
    await utils.ensureDir(DIR);
    expect(fs.existsSync(DIR)).toBe(true);
  });

  it('ensureFile(file)', async () => {
    const size = await utils.ensureFile(FILE);
    expect(fs.existsSync(FILE)).toBe(true);
    expect(size).toBe(0);
  });

  it('ensureFile(file, overwrite)', async () => {
    const size = await utils.ensureFile(FILE, true);
    expect(fs.existsSync(FILE)).toBe(true);
    expect(size).toBe(0);
  });

  it('getFiles(file)', async () => {
    const files = await utils.getFiles('test/server/testfile.mp4');
    expect(files.length).toBe(1);
  });

  it('getFiles(directory)', async () => {
    const files = await utils.getFiles('test/server');
    expect(files.length).toBeGreaterThan(1);
  });

  it('getFiles(deep directory)', async () => {
    const files = await utils.getFiles('test');
    expect(files.length).toBeGreaterThan(1);
  });

  it('getFiles(not exist)', async () => {
    const files = await utils.getFiles('test/not exist');
    expect(files.length).toBe(0);
  });

  it('getFileSize(file)', async () => {
    const size = await utils.getFileSize('test/server/testfile.mp4');
    expect(size).toBeGreaterThan(0);
  });

  it('getFileSize(not exist)', async () => {
    const size = await utils.getFileSize('test/not exist');
    expect(size).toBe(-1);
  });
});

describe('http', () => {
  const mime = 'application/vnd+json';
  const headers = { headers: { 'content-type': mime } } as any;
  const req = { headers } as IncomingMessage;

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

  it('typeis.hasBody()', () => {
    expect(utils.typeis.hasBody({ headers: {} } as any)).toBe(false);
  });

  it('getHeader(not exist)', () => {
    const res = utils.getHeader(req, 'not exist');
    expect(res).toBe('');
  });

  it('getHeader(single)', () => {
    req.headers = { head: 'value' };
    const res = utils.getHeader(req, 'head');
    expect(res).toBe('value');
  });

  it('getHeader(multiple)', () => {
    req.headers = { head: ['value1', 'value2'] };
    const res = utils.getHeader(req, 'head');
    expect(res).toBe('value1');
  });

  it('getBaseUrl(no-host)', () => {
    expect(utils.getBaseUrl(req)).toBe('');
  });

  it('getBaseUrl(no-proto)', () => {
    req.headers = { 'x-forwarded-host': 'example' };
    expect(utils.getBaseUrl(req)).toBe('//example');
  });

  it('getBaseUrl(absolute)', () => {
    req.headers = { ...req.headers, 'x-forwarded-proto': 'http' };
    expect(utils.getBaseUrl(req)).toBe('http://example');
  });
});

describe('primitives', () => {
  it('fnv', () => {
    expect(utils.fnv('teststring')).toBeGreaterThan(0);
  });

  it('pick', () => {
    expect(utils.pick({ test: 'test', rest: 'rest' }, ['test'])).toMatchObject({
      test: 'test'
    });
  });
});
