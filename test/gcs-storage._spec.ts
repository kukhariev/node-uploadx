/* set GCS environment variables to pass this test */

import { File, GCStorage } from '../src';
import { testfile } from './_utils/testfile';

describe('GCStorage', () => {
  const skip = process.env.CI;
  if (skip) {
    it.only('CI, skipping tests', () => undefined);
  }
  let storage: GCStorage;
  let filename: string;
  let file: File;

  it('should create gcs-storage', () => {
    storage = new GCStorage();
    expect(storage).toBeInstanceOf(GCStorage);
  });

  it('should create file', async () => {
    file = await storage.create({} as any, testfile);
    filename = file.name;
    expect(file).toBeInstanceOf(File);
    expect(file.uri).not.toHaveLength(0);
  });

  it('should update metadata', async () => {
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.originalName).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should return user files', async () => {
    const files = await storage.get(file.userId);
    expect(files.length).toBeGreaterThan(0);
  });

  it('should delete file', async () => {
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
  });
});
