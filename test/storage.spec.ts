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
});
