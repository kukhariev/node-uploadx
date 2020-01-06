import * as fs from 'fs';
import { join } from 'path';
import * as rimraf from 'rimraf';
import { DiskStorage, DiskStorageOptions, File } from '../src';
import { testfile, uploadDir, userId } from './server';

describe('DiskStorage', function() {
  const options: DiskStorageOptions = {
    directory: uploadDir,
    filename: file => `${file.userId}/${file.originalName}`
  };
  const filename = join(userId, testfile.originalName);
  const dstpath = join(uploadDir, filename);
  const storage = new DiskStorage(options);

  beforeAll(function() {
    rimraf.sync(uploadDir);
  });

  afterAll(function() {
    rimraf.sync(uploadDir);
  });

  it('should create file', async function() {
    await storage.create({} as any, testfile);
    expect(fs.statSync(dstpath).size).toEqual(0);
  });

  it('should update metadata', async function() {
    const file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should return user files', async function() {
    const files = await storage.get(userId);
    expect(Object.keys(files)).not.toHaveLength(0);
  });

  it('should delete file', async function() {
    const [file] = await storage.delete(filename);
    expect(file.name).toBe(filename);
  });

  it('should reset user storage', async function() {
    await storage.delete(userId);
    const files = await storage.get(userId);
    expect(Object.keys(files)).toHaveLength(0);
  });
});
