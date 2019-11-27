import { expect } from 'chai';
import { createRequest } from 'node-mocks-http';
import { BaseHandler, BaseStorage } from '../src';
class TestUploader extends BaseHandler {
  storage = (null as unknown) as BaseStorage;
}

describe('BaseHandler', function() {
  it('should create instance BaseHandler', function() {
    expect(new TestUploader()).to.be.instanceOf(BaseHandler);
  });
  describe('getPath', function() {
    const valid = ['/981e0d3bb9f93bfa62ef7938ff001308/981e0d3bb9f93bfa62ef7938ff001308'];
    const invalid = [
      '/',
      '/981e0d3bb9f93bfa62ef7938ff001308',
      '/981e0d3bb9f93bfa62ef7938ff001308?bad_id=981e0d3bb9f93bfa62ef7938ff001308'
    ];
    let uploader: BaseHandler;
    beforeEach(function() {
      uploader = new TestUploader();
    });

    it('should return path', function() {
      valid.forEach(url => {
        expect(uploader.getPath(createRequest({ url }))).to.be.equal(
          '981e0d3bb9f93bfa62ef7938ff001308'
        );
      });
    });
    it('should return empty', function() {
      invalid.forEach(url => {
        expect(uploader.getPath(createRequest({ url }))).to.be.empty;
      });
    });
  });
});
