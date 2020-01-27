import { join } from 'path';
import { DiskStorage, DiskStorageOptions, File, fsp } from '../src';
import { rm, root, userPrefix } from './fixtures/app';
import { testfile } from './fixtures/testfile';

describe('DiskStorage', () => {
  const directory = join(root, 'ds-test');
  const options: DiskStorageOptions = {
    directory,
    filename: file => `${file.userId}/${file.originalName}`
  };
  const filename = `${userPrefix}/${testfile.originalName}`;
  const dstpath = join(directory, filename);
  const storage = new DiskStorage(options);

  beforeAll(() => rm(directory));

  beforeEach(async () => {
    await storage.create({} as any, testfile);
  });

  afterAll(() => rm(directory));

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
    const [file] = await storage.get(userPrefix);
    expect(file).toMatchObject({ name: expect.any(String) });
  });

  it('should return file', async () => {
    const [file] = await storage.get(filename);
    expect(file).toMatchObject({ name: expect.any(String) });
  });

  it('should delete file', async () => {
    const [file] = await storage.delete(filename);
    expect(file.name).toBe(filename);
    expect(file).toMatchObject({ ...testfile });
  });

  // it('should reset user storage', async () => {
  //   await storage.delete(userPrefix);
  //   const [file] = await storage.get(userPrefix);
  //   expect(file).not.toBeDefined();
  // });
});
