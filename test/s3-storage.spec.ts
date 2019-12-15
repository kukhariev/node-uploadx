import { expect } from 'chai';
import { S3Storage } from '../src';

describe('S3Storage', function() {
  before(function() {
    (process.env.CI || !process.env.S3_BUCKET) && this.skip();
  });

  it('should create s3-storage', function() {
    const gcs = new S3Storage({});
    expect(gcs).to.be.instanceOf(S3Storage);
  });
});
