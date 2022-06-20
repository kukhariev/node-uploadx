import { LocalMetaStorage } from '../packages/core/src';
import * as path from 'path';
import { metafile } from './shared';
import { tmpdir } from 'os';

jest.mock('fs/promises');
jest.mock('fs');

describe('LocalMetaStorage', () => {
  it('defaults', () => {
    const meta = new LocalMetaStorage();
    const metaPath = meta.getMetaPath(metafile.id);
    expect(path.basename(metaPath)).toBe(`${metafile.id}.META`);
    expect(meta.getIdFromPath(metaPath)).toBe(metafile.id);
  });

  it('custom', () => {
    const meta = new LocalMetaStorage({
      prefix: '.',
      suffix: '.',
      directory: path.join(tmpdir(), 'meta')
    });
    const metaPath = meta.getMetaPath(metafile.id);
    expect(path.basename(metaPath)).toBe(`.${metafile.id}.`);
    expect(meta.getIdFromPath(metaPath)).toBe(metafile.id);
  });

  it('methods', async () => {
    const meta = new LocalMetaStorage();
    await meta.save(metafile.id, metafile);
    await expect(meta.get(metafile.id)).resolves.toEqual(metafile);
    const list = await meta.list(metafile.id.slice(0, 8));
    expect(list.items[0]).toMatchObject({ id: metafile.id });
    await expect(meta.list('alien')).resolves.toEqual({ items: [] });
    await meta.delete(metafile.id);
    await expect(meta.list()).resolves.toEqual({ items: [] });
  });
});
