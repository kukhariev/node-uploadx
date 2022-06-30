import * as fs from 'fs';
import { vol } from 'memfs';
import { IncomingMessage } from 'http';
import { join } from 'path';
import * as utils from '../packages/core/src';
import { testRoot } from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('utils', () => {
  const root = join(testRoot, 'fs-utils');
  const dir = join(root, '0', '1', '2');
  const filepath = join(dir, '3', `file.ext`);
  const filepath2 = join(dir, '3', `fi  le.ext.META`);

  describe('fs', () => {
    beforeEach(() => vol.reset());

    afterEach(() => vol.reset());

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
      await utils.ensureFile(`${filepath}.ext`);
      await utils.ensureFile(filepath2);
      await utils.ensureFile(`${filepath2}.ext`);
      await expect(utils.getFiles(filepath)).resolves.toHaveLength(2);
      await expect(utils.getFiles(filepath2)).resolves.toHaveLength(2);
    });

    it('getFiles(prefix)', async () => {
      await utils.ensureFile(filepath);
      await utils.ensureFile(filepath2);
      await expect(utils.getFiles(`${testRoot}/fs-`)).resolves.toHaveLength(2);
      await expect(utils.getFiles(`${testRoot}\\fs-`)).resolves.toHaveLength(2);
      await expect(utils.getFiles(`${testRoot}\fs-`)).resolves.toHaveLength(0);
      await expect(utils.getFiles(`${testRoot}/fs_`)).resolves.toHaveLength(0);
    });

    it('getFiles(directory)', async () => {
      await utils.ensureFile(filepath);
      await utils.ensureFile(filepath2);
      await expect(utils.getFiles(testRoot)).resolves.toHaveLength(2);
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

    it('removeFile(path)', async () => {
      await utils.ensureFile(filepath);
      await utils.removeFile(filepath);
      expect(fs.existsSync(filepath)).toBe(false);
    });

    it('removeFile(not exist)', async () => {
      await utils.removeFile(filepath);
      expect(fs.existsSync(filepath)).toBe(false);
    });
  });

  describe('fs-stream', () => {
    it('getWriteStream(path, 0)', async () => {
      await utils.ensureFile('filepath');
      const stream = utils.getWriteStream('filepath', 0);
      stream.close();
      expect(stream).toBeInstanceOf(fs.WriteStream);
    });
  });

  describe('http', () => {
    const mime = 'application/vnd+json';
    const req = { headers: { 'content-type': mime } } as IncomingMessage;

    it('typeis()', () => {
      expect(utils.typeis({ headers: {} } as IncomingMessage, ['json'])).toBe(false);
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
      expect(utils.typeis.hasBody({ headers: {} } as IncomingMessage)).toBe(false);
      expect(utils.typeis.hasBody({ headers: { 'content-length': '0' } } as IncomingMessage)).toBe(
        0
      );
      expect(utils.typeis.hasBody({ headers: { 'content-length': '1' } } as IncomingMessage)).toBe(
        1
      );
    });

    it('getHeader(not exist)', () => {
      expect(utils.getHeader(req, 'not exist')).toBe('');
    });

    it('getHeader(single)', () => {
      req.headers = { head: 'value' };
      expect(utils.getHeader(req, 'head')).toBe('value');
    });

    it('getHeader(array)', () => {
      req.headers = { head: ['value1', 'value2 '] };
      expect(utils.getHeader(req, 'head')).toBe('value2');
    });

    it('getHeader(multiple)', () => {
      req.headers = { head: 'value1 ,value2' };
      expect(utils.getHeader(req, 'head')).toBe('value2');
    });

    it('getHeader(multiple, all)', () => {
      req.headers = { head: 'value1,value2 ' };
      expect(utils.getHeader(req, 'head', true)).toBe('value1,value2');
    });

    it('getBaseUrl(no-host)', () => {
      expect(utils.getBaseUrl(req)).toBe('');
    });

    it('getBaseUrl(no-proto)', () => {
      req.headers = { host: 'example' };
      expect(utils.getBaseUrl(req)).toBe('//example');
    });

    it('getBaseUrl(absolute)', () => {
      req.headers = { host: 'example:4443', 'x-forwarded-proto': 'https' };
      expect(utils.getBaseUrl(req)).toBe('https://example:4443');
    });
  });

  describe('primitives', () => {
    it('fnv', () => {
      expect(utils.fnv('123456')).toBe('9995b6aa');
    });

    it('fnv64', () => {
      expect(utils.fnv64('123456')).toBe('f6e3ed7e0e67290a');
    });

    it('pick', () => {
      expect(utils.pick({ test: 'test', rest: 'rest' }, ['test'])).toMatchObject({
        test: 'test'
      });
    });

    it('isEqual', () => {
      expect(utils.isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(utils.isEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 })).toBe(false);
      expect(utils.isEqual({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }, 'c')).toBe(true);
      expect(utils.isEqual({ a: 1, b: 2, c: { k: 3 } }, { a: 1, b: 2, c: { k: 3 } })).toBe(true);
      expect(utils.isEqual({ a: 1, b: 2, c: { k: 3 } }, { a: 1, b: 2, c: { k: 4 } })).toBe(false);
    });

    it('memoize', () => {
      const md5Cached = utils.memoize(utils.md5);
      const fnvCached = utils.memoize(utils.fnv);
      expect(md5Cached('123456')).toBe('e10adc3949ba59abbe56e057f20f883e');
      expect(fnvCached('123456')).toBe('9995b6aa');
    });
  });
});
