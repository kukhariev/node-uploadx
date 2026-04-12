import type { File } from '../packages/core/src';
import { metafile, TestStorage } from './shared';

describe('BaseStorage', () => {
  let storage: TestStorage;

  beforeEach(() => (storage = new TestStorage()));

  async function createAndSaveMetafile(): Promise<File> {
    const init: File = {
      id: 'size.409',
      originalName: 'testfile.mp4',
      size: 409,
      contentType: 'video/mp4'
    } as File;
    const created = await storage.create({}, init);
    return storage.saveMeta(created);
  }

  it('should set maxUploadSize', () => {
    expect(storage.maxUploadSize).toBe(5497558138880);
  });

  it('should validate', async () => {
    await expect(storage.validate(metafile)).resolves.toBeUndefined();
  });

  it('should validate error', async () => {
    await expect(storage.validate({ ...metafile, name: '../file.ext' })).rejects.toHaveProperty(
      'statusCode'
    );
  });

  it('should check if expired', async () => {
    await expect(
      storage.checkIfExpired({ ...metafile, expiredAt: Date.now() - 100 })
    ).rejects.toHaveProperty('uploadxErrorCode', 'Gone');
  });

  it('should check if not expired', async () => {
    storage = new TestStorage({ expiration: { maxAge: '1h' } });
    expect(storage.checkIfExpired({ ...metafile, expiredAt: Date.now() + 1000 })).toBeTruthy();
  });

  it('should save meta and update cache', async () => {
    const meta = await createAndSaveMetafile();
    expect(storage.cache.get(meta.id)).toMatchObject(meta);
  });

  it('should get meta from cache', async () => {
    const meta = await createAndSaveMetafile();
    const result = await storage.getMeta(meta.id);
    expect(result.id).toBe(meta.id);
    expect(result.name).toBe(meta.name);
  });

  it('should delete meta and cache', async () => {
    const meta = await createAndSaveMetafile();
    expect(storage.cache.get(meta.id)).toBeDefined();
    await storage.deleteMeta(meta.id);
    expect(storage.cache.get(meta.id)).toBeUndefined();
  });

  it('should touch and update cache', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2022-02-02'));
    const meta = await createAndSaveMetafile();
    const updated = await storage.update(meta, { name: 'newname.mp4' });
    expect(updated.name).toBe('newname.mp4');
    expect(storage.cache.get(meta.id)?.name).toBe('newname.mp4');
    jest.useRealTimers();
  });

  it('should list uploads', async () => {
    const list = await storage.list();
    expect(list).toHaveProperty('items');
  });

  it('should set maxMetadataSize', () => {
    storage = new TestStorage({ maxMetadataSize: '4MB' });
    expect(storage.maxMetadataSize).toBe(4194304);
  });

  it('should have loggers', () => {
    expect(storage.logger).toBeDefined();
    expect(storage.meta.logger).toBeDefined();
    expect(storage.logger).not.toBe(storage.meta.logger);
  });

  it('should configure logger via logLevel option', () => {
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    storage = new TestStorage({ logLevel: 'debug' });
    // Verify that debug logging is active
    expect(spy).toHaveBeenCalled(); // this.logger.debug('configuration: {config}', { config });
    expect(storage.config.logLevel).toBe('debug');
    spy.mockRestore();
  });
});
