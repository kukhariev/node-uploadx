/* eslint-disable @typescript-eslint/unbound-method */
import { createRequest, createResponse } from 'node-mocks-http';
import { BaseHandler, BaseStorage } from '../src';

class TestUploader extends BaseHandler {
  storage = ({
    path: '/files',
    isReady: true,
    get: (url: any) => Promise.resolve([])
  } as unknown) as BaseStorage;
}

describe('BaseHandler', () => {
  let uploader: TestUploader;
  beforeEach(() => {
    uploader = new TestUploader();
  });

  it('should implement get()', () => {
    expect(uploader.get({ url: '' } as any)).resolves.toEqual([]);
  });

  it('should check if storage not ready', () => {
    uploader.storage.isReady = false;
    const res = createResponse();
    uploader.handle(createRequest(), res);
    expect(res.statusCode).toEqual(503);
  });

  it('should check http method', () => {
    const res = createResponse();
    uploader.handle(createRequest({ method: 'TRACE' }), res);
    expect(res.statusCode).toEqual(404);
  });

  describe('getPath(framework)', () => {
    const valid = ['/1/2', '/3', '/files'];
    const paths = ['1/2', '3', 'files'];
    const invalid = ['/'];

    it('should return path', () => {
      valid.forEach((url, i) => expect(uploader.getName(createRequest({ url }))).toBe(paths[i]));
    });

    it('should return empty', () => {
      invalid.forEach(url => expect(uploader.getName(createRequest({ url }))).toHaveLength(0));
    });
  });

  describe('getPath(node http)', () => {
    const valid = ['/files/1/2', '/files/3', '/files/4/5/files/6/files/7'];
    const paths = ['1/2', '3', '4/5/files/6/files/7'];
    const invalid = ['/', '/1/2', '/3', '/4/5/files/6/files/7'];

    it('should return path', () => {
      valid.forEach((url, i) => expect(uploader.getName({ url } as any)).toBe(paths[i]));
    });

    it('should return empty', () => {
      invalid.forEach(url => expect(uploader.getName({ url } as any)).toHaveLength(0));
    });
  });
});
