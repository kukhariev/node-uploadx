import { MetaStorage } from '../packages/core/src';
import { metafile } from './shared';

describe('MetaStorage', () => {
  const metaStorage = new MetaStorage();

  it('has props', () => {
    expect(metaStorage).toHaveProperty('prefix', '');
    expect(metaStorage).toHaveProperty('suffix', '.META');
  });

  it('save', async () => {
    await expect(metaStorage.save(metafile.id, metafile)).resolves.toBe(metafile);
  });

  it('get', async () => {
    await expect(metaStorage.get(metafile.id)).rejects.toBeFalsy();
  });

  it('delete', async () => {
    await expect(metaStorage.delete(metafile.id)).resolves.toBeFalsy();
  });

  it('list', async () => {
    await expect(metaStorage.list()).resolves.toEqual({ items: [] });
  });
});
