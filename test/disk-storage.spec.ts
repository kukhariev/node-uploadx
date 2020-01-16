import * as fs from 'fs';
import { join } from 'path';
import { DiskStorage, DiskStorageOptions, File } from '../src';
import { rm, root, userPrefix } from './fixtures/app';
import { testfile } from './fixtures/testfile';

describe('DiskStorage', () => {
  const directory = join(root, 'ds-test');
  const options: DiskStorageOptions = {
    directory,
    filename: file => `${file.userId}/${file.originalName}`
  };
  const filename = join(userPrefix, testfile.originalName);
  const dstpath = join(directory, filename);
  const storage = new DiskStorage(options);

  beforeAll(() => rm(directory));

  afterAll(() => rm(directory));

  it('should create file', async () => {
    await storage.create({} as any, testfile);
    expect(fs.statSync(dstpath).size).toEqual(0);
  });

  it('should update metadata', async () => {
    const file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should return user files', async () => {
    const files = await storage.get(userPrefix);
    expect(Object.keys(files)).not.toHaveLength(0);
  });

  it('should delete file', async () => {
    const [file] = await storage.delete(filename);
    expect(file.name).toBe(filename);
  });

  it('should reset user storage', async () => {
    await storage.delete(userPrefix);
    const files = await storage.get(userPrefix);
    expect(Object.keys(files)).toHaveLength(0);
  });
});
