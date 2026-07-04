import { LocalMetaStorage } from '../packages/core/src';
import { metafile } from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('LocalMetaStorage', () => {
  describe('list', () => {
    it('default', async () => {
      const meta = new LocalMetaStorage({ directory: '/m1' });
      await meta.save(metafile.id, metafile);
      const list = await meta.list();
      expect(list.items).toHaveLength(1);
      expect(list.items[0]).toMatchObject({ id: metafile.id });
    });

    it('custom', async () => {
      const meta = new LocalMetaStorage({ prefix: '.', suffix: '.', directory: '/m2' });
      await meta.save(metafile.id, metafile);
      const list = await meta.list();
      expect(list.items).toHaveLength(1);
      expect(list.items[0]).toMatchObject({ id: metafile.id });
    });

    it('empty suffix', async () => {
      const meta = new LocalMetaStorage({ suffix: '', directory: '/m3' });
      await meta.save(metafile.id, metafile);
      const list = await meta.list();
      expect(list.items).toHaveLength(1);
      expect(list.items[0].id).toBe(metafile.id);
    });

    it('with idPrefix', async () => {
      const meta = new LocalMetaStorage({ directory: '/m4' });
      const idPrefix = metafile.id.slice(0, 8);
      await meta.save(metafile.id, metafile);
      const list = await meta.list(idPrefix);
      expect(list.items[0]).toMatchObject({ id: metafile.id });
      await expect(meta.list('alien')).resolves.toEqual({ items: [] });
    });
  });
});
