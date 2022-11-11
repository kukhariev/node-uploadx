import { metafile, TestStorage } from './shared';

describe('BaseStorage', () => {
  let storage;

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
});
