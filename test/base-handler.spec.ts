import { createRequest } from 'node-mocks-http';
import { BaseHandler, BaseStorage } from '../src';

class TestUploader extends BaseHandler {
  storage = { path: '/files' } as BaseStorage;
}

describe('BaseHandler', () => {
  it('should create instance BaseHandler', () => {
    expect(new TestUploader()).toBeInstanceOf(BaseHandler);
  });

  describe('getPath(framework)', () => {
    const valid = ['/1/2', '/3', '/files'];
    const paths = ['1/2', '3', 'files'];
    const invalid = ['/'];
    let uploader: BaseHandler;
    beforeEach(() => {
      uploader = new TestUploader();
    });

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
    let uploader: BaseHandler;

    beforeEach(() => {
      uploader = new TestUploader();
    });

    it('should return path', () => {
      valid.forEach((url, i) => expect(uploader.getName({ url } as any)).toBe(paths[i]));
    });

    it('should return empty', () => {
      invalid.forEach(url => expect(uploader.getName({ url } as any)).toHaveLength(0));
    });
  });
});
