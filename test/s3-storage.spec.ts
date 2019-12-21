import { expect } from 'chai';
import { File, S3File, S3Storage } from '../src';
import { testfile } from './testfile';

describe('S3Storage', function() {
  let storage: S3Storage;
  let filename: string;
  let file: File;
  before(function() {
    (process.env.CI || !process.env.S3_BUCKET) && this.skip();
  });

  it('should create s3-storage', function() {
    storage = new S3Storage({});
    expect(storage).to.be.instanceOf(S3Storage);
  });
  it('should create file', async function() {
    file = await storage.create({} as any, testfile);
    filename = file.name;
    expect(file).to.be.instanceOf(File);
    expect((file as S3File)['UploadId']).to.be.not.empty;
  });

  it('should update metadata', async function() {
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).to.be.eq('newname.mp4');
    expect(file.metadata.mimeType).to.be.eq('video/mp4');
  });

  it('should return user files', async function() {
    const files = await storage.get(file.userId);
    expect(files).to.be.not.empty;
  });

  it('should delete file', async function() {
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).to.be.eq(filename);
  });
});
