import { TestStorage } from './fixtures/uploader';
import { testfile } from './fixtures/testfile';

describe('BaseStorage', () => {
  let storage;

  it('should set maxUploadSize', () => {
    storage = new TestStorage();
    expect(storage.maxUploadSize).toBe(5497558138880);
  });

  it('should validate', () => {
    storage = new TestStorage();
    return expect(storage.validate(testfile)).resolves.toBeUndefined();
  });

  it('should validate error', () => {
    storage = new TestStorage();
    return expect(
      storage.validate({ ...testfile, originalName: '../file.ext' })
    ).rejects.toHaveProperty('statusCode');
  });
});
