import * as fs from 'fs';
import { IncomingMessage } from 'http';
import { join } from 'path';
import * as utils from '../packages/core/src/utils';
import { getWriteStream } from '../packages/core/src/utils';
import { root } from './fixtures';
import { cleanup } from './fixtures/utils';

describe('fs', () => {
  const directory = join(root, 'fs-test');
  const deep = `${directory}/1/2`;
  const file = `${deep}/3/file.ext`;
  const file2 = `${deep}/3/fi  le.ext.META`;

  beforeAll(() => cleanup(directory));

  afterAll(() => cleanup(directory));

  it('ensureDir(dir)', async () => {
    await utils.ensureDir(deep);
    expect(fs.existsSync(deep)).toBe(true);
  });

  it('ensureFile(file)', async () => {
    const size = await utils.ensureFile(file);
    expect(fs.existsSync(file)).toBe(true);
    expect(size).toBe(0);
  });

  it('ensureFile(file2)', async () => {
    const size = await utils.ensureFile(file2);
    expect(fs.existsSync(file2)).toBe(true);
    expect(size).toBe(0);
  });

  it('ensureFile(file, overwrite)', async () => {
    const size = await utils.ensureFile(file, true);
    expect(fs.existsSync(file)).toBe(true);
    expect(size).toBe(0);
  });

  it('getFiles(file)', async () => {
    const files = await utils.getFiles(file);
    expect(files).toHaveLength(1);
  });

  it('getFiles(directory)', async () => {
    const files = await utils.getFiles(directory);
    expect(files).toHaveLength(2);
  });

  it('getFiles(deep directory)', async () => {
    const files = await utils.getFiles(deep);
    expect(files).toHaveLength(2);
  });

  it('getFiles(not exist)', async () => {
    const files = await utils.getFiles('test/not exist');
    expect(files).toHaveLength(0);
  });

  it('getWriteStream', () => {
    const stream = getWriteStream(file, 0);
    expect(stream).toBeInstanceOf(fs.WriteStream);
    stream.close();
  });

  it('getWriteStream (throw)', () => {
    expect(() => getWriteStream('', NaN)).toThrow();
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
    expect(utils.fnv('test string')).toBeGreaterThan(0);
  });

  it('pick', () => {
    expect(utils.pick({ test: 'test', rest: 'rest' }, ['test'])).toMatchObject({
      test: 'test'
    });
  });
});
