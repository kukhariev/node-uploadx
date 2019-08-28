import { expect } from 'chai';
import { BaseHandler, BaseStorage } from '../src';
class TestUploader extends BaseHandler {
  storage = (null as unknown) as BaseStorage;
}
describe('BaseHandler', function() {
  let uploader: TestUploader;
  it('should create instance BaseHandler', function() {
    uploader = new TestUploader();
    expect(uploader).to.be.instanceOf(BaseHandler);
  });
});
