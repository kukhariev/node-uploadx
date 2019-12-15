import { expect } from 'chai';
import { createRequest } from 'node-mocks-http';
import { BaseHandler, BaseStorage } from '../src';

class TestUploader extends BaseHandler {
  storage = { path: '/upload' } as BaseStorage;
}

describe('BaseHandler', function() {
  it('should create instance BaseHandler', function() {
    expect(new TestUploader()).to.be.instanceOf(BaseHandler);
  });

  describe('getPath(framework)', function() {
    const valid = ['/1/2', '/3', '/upload'];
    const paths = ['1/2', '3', 'upload'];
    const invalid = ['/'];
    let uploader: BaseHandler;
    beforeEach(function() {
      uploader = new TestUploader();
    });

    it('should return path', function() {
      valid.forEach((url, i) =>
        expect(uploader.getPath(createRequest({ url }))).to.be.eq(paths[i])
      );
    });

    it('should return empty', function() {
      invalid.forEach(url => expect(uploader.getPath(createRequest({ url }))).to.be.empty);
    });
  });

  describe('getPath(node http)', function() {
    const valid = ['/upload/1/2', '/upload/3', '/upload/4/5/upload/6/upload/7'];
    const paths = ['1/2', '3', '4/5/upload/6/upload/7'];
    const invalid = ['/', '/1/2', '/3', '/4/5/upload/6/upload/7'];
    let uploader: BaseHandler;

    beforeEach(function() {
      uploader = new TestUploader();
    });

    it('should return path', function() {
      valid.forEach((url, i) => expect(uploader.getPath({ url } as any)).to.be.eq(paths[i]));
    });

    it('should return empty', function() {
      invalid.forEach(url => expect(uploader.getPath({ url } as any)).to.be.empty);
    });
  });
});
