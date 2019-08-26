import { expect } from 'chai';
import { BaseHandler } from '../src/core';
class TestUploader extends BaseHandler {}
describe('BaseHandler', function() {
  let uploader: TestUploader;
  it('should create instance BaseHandler', function() {
    uploader = new TestUploader({});
    expect(uploader).to.be.instanceOf(BaseHandler);
  });
  it('should have `config` property', function() {
    uploader = new TestUploader({});
    expect(uploader).to.be.haveOwnProperty('config');
  });
});
