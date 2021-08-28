import * as fs from 'fs';
import { IncomingMessage } from 'http';
import { join } from 'path';
import * as utils from '../packages/core/src/utils';
import { root } from './fixtures';
import { cleanup } from './fixtures/utils';

describe('fs', () => {
  const dir = join(root, 'fs-test', '1', '2');
  const filepath = join(dir, '3', `file.ext`);
  const filepath2 = join(dir, '3', `fi  le.ext.META`);

  beforeAll(() => cleanup(root));

  afterEach(() => cleanup(root));

  it('ensureDir(dir)', async () => {
    await utils.ensureDir(dir);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('ensureFile(file)', async () => {
    const size = await utils.ensureFile(filepath);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(size).toBe(0);
  });

  it('ensureFile(file, overwrite)', async () => {
    const size = await utils.ensureFile(filepath, true);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(size).toBe(0);
  });

  it('getFiles(full path)', async () => {
    await utils.ensureFile(filepath);
    await utils.ensureFile(filepath2);
    await expect(utils.getFiles(filepath)).resolves.toHaveLength(1);
    await expect(utils.getFiles(filepath2)).resolves.toHaveLength(1);
  });

  it('getFiles(prefix)', async () => {
    await utils.ensureFile(filepath);
    await utils.ensureFile(filepath2);
    await expect(utils.getFiles('files/fs-')).resolves.toHaveLength(2);
    await expect(utils.getFiles('files\\fs-')).resolves.toHaveLength(2);
    await expect(utils.getFiles('files\fs-')).resolves.toHaveLength(0);
    await expect(utils.getFiles('files/fs_')).resolves.toHaveLength(0);
  });

  it('getFiles(directory)', async () => {
    await utils.ensureFile(filepath);
    await utils.ensureFile(filepath2);
    await expect(utils.getFiles(root)).resolves.toHaveLength(2);
  });

  it('getFiles(deep directory)', async () => {
    await utils.ensureFile(filepath);
    await utils.ensureFile(filepath2);
    await expect(utils.getFiles(dir)).resolves.toHaveLength(2);
  });

  it('getFiles(not existing)', async () => {
    await utils.ensureFile(filepath);
    await expect(utils.getFiles('not exist')).resolves.toHaveLength(0);
  });

  it('getWriteStream(path, 0)', async () => {
    await utils.ensureFile(filepath);
    const stream = utils.getWriteStream(filepath, 0);
    expect(stream).toBeInstanceOf(fs.WriteStream);
    stream.close();
  });

  it('getWriteStream(path, NaN)', () => {
    expect(() => utils.getWriteStream('', NaN)).toThrow();
  });

  it('getWriteStream(not exist , 0)', () => {
    expect(() => utils.getWriteStream('', 0)).toThrow();
  });
});

describe('http', () => {
  const mime = 'application/vnd+json';
  const req = { headers: { 'content-type': mime } } as IncomingMessage;

  it('typeis()', () => {
    expect(utils.typeis({ headers: {} } as any, ['json'])).toBe(false);
    expect(utils.typeis(req, ['html'])).toBe(false);
    expect(utils.typeis(req, ['json'])).toBe(mime);
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
    expect(utils.typeis.hasBody({ headers: { 'content-length': '0' } } as IncomingMessage)).toBe(0);
    expect(utils.typeis.hasBody({ headers: { 'content-length': '1' } } as IncomingMessage)).toBe(1);
  });

  it('getHeader(not exist)', () => {
    expect(utils.getHeader(req, 'not exist')).toBe('');
  });

  it('getHeader(single)', () => {
    req.headers = { head: 'value' };
    expect(utils.getHeader(req, 'head')).toBe('value');
  });

  it('getHeader(multiple)', () => {
    req.headers = { head: ['value1', 'value2'] };
    expect(utils.getHeader(req, 'head')).toBe('value1');
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
    expect(utils.fnv('test string')).toBeGreaterThan(0);
  });

  it('pick', () => {
    expect(utils.pick({ test: 'test', rest: 'rest' }, ['test'])).toMatchObject({
      test: 'test'
    });
  });
});
