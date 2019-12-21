import { expect } from 'chai';
import { File, GCStorage } from '../src';
import { testfile } from './testfile';

describe('GCStorage', function() {
  let storage: GCStorage;
  let filename: string;
  let file: File;
  before(function() {
    (process.env.CI || !process.env.GCS_BUCKET) && this.skip();
  });

  it('should create gcs-storage', function() {
    storage = new GCStorage();
    expect(storage).to.be.instanceOf(GCStorage);
  });
  it('should create file', async function() {
    file = await storage.create({} as any, testfile);
    filename = file.name;
    expect(file).to.be.instanceOf(File);
    expect(file.uri).to.be.not.empty;
  });

  it('should update metadata', async function() {
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).to.be.eq('newname.mp4');
    expect(file.originalName).to.be.eq('newname.mp4');
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
