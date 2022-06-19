import { LocalMetaStorage } from '../packages/core/src';
import * as path from 'path';
import { testfile } from './shared';
import { tmpdir } from 'os';

jest.mock('fs/promises');
jest.mock('fs');

describe('LocalMetaStorage', () => {
  it('defaults', () => {
    const meta = new LocalMetaStorage();
    const metaPath = meta.getMetaPath(testfile.id);
    expect(path.basename(metaPath)).toBe(`${testfile.id}.META`);
    expect(meta.getIdFromPath(metaPath)).toBe(testfile.id);
  });

  it('custom', () => {
    const meta = new LocalMetaStorage({
      prefix: '.',
      suffix: '.',
      directory: path.join(tmpdir(), 'meta')
    });
    const metaPath = meta.getMetaPath(testfile.id);
    expect(path.basename(metaPath)).toBe(`.${testfile.id}.`);
    expect(meta.getIdFromPath(metaPath)).toBe(testfile.id);
  });

  it('methods', async () => {
    const meta = new LocalMetaStorage();
    await meta.save(testfile.id, testfile);
    await expect(meta.get(testfile.id)).resolves.toEqual(testfile);
    const list = await meta.list(testfile.id.slice(0, 8));
    expect(list.items[0]).toMatchObject({ id: testfile.id });
    await expect(meta.list('alien')).resolves.toEqual({ items: [] });
    await meta.delete(testfile.id);
    await expect(meta.list()).resolves.toEqual({ items: [] });
  });
});
