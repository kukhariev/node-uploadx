import { MetaStorage } from '../packages/core/src';
import { testfile } from './shared';

describe('MetaStorage', () => {
  const metaStorage = new MetaStorage();

  it('has props', () => {
    expect(metaStorage).toHaveProperty('prefix', '');
    expect(metaStorage).toHaveProperty('suffix', '.META');
  });

  it('save', async () => {
    await expect(metaStorage.save(testfile.id, testfile)).resolves.toBe(testfile);
  });

  it('get', async () => {
    await expect(metaStorage.get(testfile.id)).rejects.toBeFalsy();
  });

  it('delete', async () => {
    await expect(metaStorage.delete(testfile.id)).resolves.toBeFalsy();
  });

  it('list', async () => {
    await expect(metaStorage.list()).resolves.toEqual({ items: [] });
  });
});
