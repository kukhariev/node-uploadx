/* set GCS environment variables to pass this test */

import { File, GCStorage } from '../src';
import { testfile } from './server/testfile';

describe('GCStorage', function() {
  const skip = process.env.CI;
  if (skip) {
    it.only('CI, skipping tests', () => undefined);
  }
  let storage: GCStorage;
  let filename: string;
  let file: File;

  it('should create gcs-storage', function() {
    storage = new GCStorage();
    expect(storage).toBeInstanceOf(GCStorage);
  });

  it('should create file', async function() {
    file = await storage.create({} as any, testfile);
    filename = file.name;
    expect(file).toBeInstanceOf(File);
    expect(file.uri).not.toHaveLength(0);
  });

  it('should update metadata', async function() {
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.originalName).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should return user files', async function() {
    const files = await storage.get(file.userId);
    expect(Object.keys(files)).not.toHaveLength(0);
  });

  it('should delete file', async function() {
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
  });
});
