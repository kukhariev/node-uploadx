import type { File } from '../packages/core/src';
import { metafile, TestStorage } from './shared';

describe('BaseStorage', () => {
  let storage: TestStorage;

  async function createFile(overrides: Partial<File> = {}): Promise<File> {
    const init = {
      ...metafile,
      metadata: { ...metafile.metadata },
      ...overrides
    } as File;
    const created = await storage.create({}, init);
    return storage.saveMeta(created);
  }

  it('should share logger', () => {
    storage = new TestStorage();
    expect(storage.logger).toBe(storage.meta.logger);
  });

  it('should share custom logger', () => {
    const logger = console;
    const consoleDebugMock = jest.spyOn(console, 'debug').mockImplementation();
    storage = new TestStorage({ logger });
    expect(storage.logger).toBe(storage.meta.logger);
    consoleDebugMock.mockRestore();
  });

  it('should set maxUploadSize', () => {
    storage = new TestStorage();
    expect(storage.maxUploadSize).toBe(5497558138880);
  });

  it('should validate', () => {
    storage = new TestStorage();
    return expect(storage.validate(metafile)).resolves.toBeUndefined();
  });

  it('should validate error', () => {
    storage = new TestStorage();
    return expect(storage.validate({ ...metafile, name: '../file.ext' })).rejects.toHaveProperty(
      'statusCode'
    );
  });

  it('should check if expired', async () => {
    storage = new TestStorage();
    await expect(
      storage.checkIfExpired({ ...metafile, expiredAt: Date.now() - 100 })
    ).rejects.toHaveProperty('uploadxErrorCode', 'Gone');
  });

  it('should support logger', () => {
    jest.useFakeTimers().setSystemTime(new Date('2022-02-02'));
    const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation();
    storage = new TestStorage({ logLevel: 'warn' });
    storage.logger.warn('some', 'warning');
    expect(consoleWarnMock).toHaveBeenCalledWith(
      '2022-02-02T00:00:00.000Z WARN uploadx: some warning'
    );
    consoleWarnMock.mockRestore();
    jest.useRealTimers();
  });

  it('should support custom logger', () => {
    const consoleDebugMock = jest.spyOn(console, 'debug').mockImplementation();
    storage = new TestStorage({ logger: console });
    storage.logger.debug('some', 'value');
    expect(consoleDebugMock).toHaveBeenCalledWith('some', 'value');
    consoleDebugMock.mockRestore();
  });

  it('should save meta and update cache', async () => {
    storage = new TestStorage();
    const created = await createFile({ bytesWritten: 100 });
    const result = await storage.saveMeta({
      ...created,
      bytesWritten: 200,
      status: 'part' as const
    });

    expect(result.bytesWritten).toBe(200);
    expect(storage.cache.get(metafile.id)!.bytesWritten).toBe(200);
  });

  it('should update user metadata', async () => {
    storage = new TestStorage();
    await createFile();

    const result = await storage.update(
      { id: metafile.id },
      {
        metadata: { name: 'newname.mp4', customKey: 'customValue', tags: ['tag1', 'tag2', 'tag3'] }
      }
    );

    expect(result.metadata.name).toBe('newname.mp4');
    expect(result.metadata.customKey).toBe('customValue');
    expect(result.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
    expect(storage.cache.get(metafile.id)!.metadata.name).toBe('newname.mp4');
  });

  it('should call meta.save (not touch) when user metadata changes', async () => {
    storage = new TestStorage();
    await createFile();

    const saveSpy = jest.spyOn(storage.meta, 'save');
    const touchSpy = jest.spyOn(storage.meta, 'touch');

    await storage.update(
      { id: metafile.id },
      {
        metadata: { name: 'newname.mp4', customKey: 'customValue', tags: ['tag1', 'tag2', 'tag3'] }
      }
    );

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(touchSpy).not.toHaveBeenCalled();
  });

  it('should call meta.save when user metadata deep changed', async () => {
    storage = new TestStorage();
    await createFile({
      metadata: { customKey: 'customValue', tags: ['tag1', 'tag2', 'tag3'] }
    });

    const saveSpy = jest.spyOn(storage.meta, 'save');
    const touchSpy = jest.spyOn(storage.meta, 'touch');

    await storage.update(
      { id: metafile.id },
      {
        metadata: { customKey: 'customValue', tags: ['tag1', 'tag2', 'tag4'] }
      }
    );

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(touchSpy).toHaveBeenCalledTimes(0);
  });

  it('should call meta.touch when only bytesWritten or expiredAt change', async () => {
    storage = new TestStorage();
    await createFile({ bytesWritten: 100 });

    const saveSpy = jest.spyOn(storage.meta, 'save');
    const touchSpy = jest.spyOn(storage.meta, 'touch');

    const cached = storage.cache.get(metafile.id)!;
    await storage.saveMeta({ ...cached, bytesWritten: 200, expiredAt: '2099-01-01T00:00:00.000Z' });

    expect(touchSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
