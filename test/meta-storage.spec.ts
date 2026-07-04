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

  describe('getIdFromMetaName', () => {
    it('default suffix', () => {
      const meta = new MetaStorage();
      const name = meta.getMetaName(metafile.id);
      expect(name).toBe(`${metafile.id}.META`);
      expect(meta.getIdFromMetaName(name)).toBe(metafile.id);
    });

    it('custom prefix', () => {
      const meta = new MetaStorage({ prefix: 'archive/' });
      const name = meta.getMetaName(metafile.id);
      expect(name).toBe(`archive/${metafile.id}.META`);
      expect(meta.getIdFromMetaName(name)).toBe(metafile.id);
    });

    it('custom suffix', () => {
      const meta = new MetaStorage({ suffix: '.json' });
      const name = meta.getMetaName(metafile.id);
      expect(name).toBe(`${metafile.id}.json`);
      expect(meta.getIdFromMetaName(name)).toBe(metafile.id);
    });

    it('custom both', () => {
      const meta = new MetaStorage({ prefix: 'logs/', suffix: '.meta' });
      const name = meta.getMetaName(metafile.id);
      expect(name).toBe(`logs/${metafile.id}.meta`);
      expect(meta.getIdFromMetaName(name)).toBe(metafile.id);
    });

    it('empty suffix', () => {
      const meta = new MetaStorage({ suffix: '' });
      const name = meta.getMetaName(metafile.id);
      expect(name).toBe(metafile.id);
      expect(meta.getIdFromMetaName(name)).toBe(metafile.id);
    });
  });
});
