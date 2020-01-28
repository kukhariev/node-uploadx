import { join } from 'path';
import { DiskStorage, File, fsp } from '../src';
import { filename, root, storageOptions, testfile } from './fixtures';
import rimraf = require('rimraf');

describe('DiskStorage', () => {
  const directory = join(root, 'ds-test');
  const options = { ...storageOptions, directory };
  const dstpath = join(directory, filename);
  const storage = new DiskStorage(options);

  beforeAll(() => rimraf.sync(directory));

  beforeEach(async () => {
    await storage.create({} as any, testfile);
  });

  afterEach(() => rimraf.sync(directory));

  it('should create file', async () => {
    const { size } = await fsp.stat(dstpath);
    expect(size).toBe(0);
  });

  it('should update metadata', async () => {
    const file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should return user files', async () => {
    const files = await storage.get(testfile.userId);
    expect(files).toEqual(expect.any(Array));
    expect(files.length).toEqual(1);
    expect(files[0]).toMatchObject({ name: filename });
  });

  it('should return file', async () => {
    const files = await storage.get(filename);
    expect(files).toEqual(expect.any(Array));
  });

  it('should delete file', async () => {
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
    expect(deleted.status).toBe<File['status']>('deleted');
  });
});
