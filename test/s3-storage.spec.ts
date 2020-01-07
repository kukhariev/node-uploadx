/* set AWS environment variables to pass this test */

import { File, S3File, S3Storage } from '../src';
import { testfile } from './server/testfile';

describe('S3Storage', () => {
  const skip = process.env.CI;
  if (skip) {
    it.only('CI, skipping tests', () => undefined);
  }
  let storage: S3Storage;
  let filename: string;
  let file: File;

  it('should create s3-storage', () => {
    storage = new S3Storage({});
    expect(storage).toBeInstanceOf(S3Storage);
  });

  it('should create file', async () => {
    file = await storage.create({} as any, testfile);
    filename = file.name;
    expect(file).toBeInstanceOf(File);
    expect((file as S3File)['UploadId']).not.toHaveLength(0);
  });

  it('should update metadata', async () => {
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should return user files', async () => {
    const files = await storage.get(file.userId);
    expect(Object.keys(files)).not.toHaveLength(0);
  });

  it('should delete file', async () => {
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
  });
});
