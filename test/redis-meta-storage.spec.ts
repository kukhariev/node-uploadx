import { RedisMetaStorage } from '../packages/core/src';
import { metafile } from './shared';

jest.mock('ioredis', () => require('ioredis-mock'));

describe('RedisMetaStorage', () => {
  let meta: RedisMetaStorage;

  beforeEach(() => {
    meta = new RedisMetaStorage({ prefix: 'test:' });
  });

  afterEach(async () => {
    await meta.close();
  });

  it('save and get', async () => {
    const saved = await meta.save(metafile.id, metafile);
    expect(saved).toBe(metafile);
    const retrieved = await meta.get(metafile.id);
    expect(retrieved).toEqual(metafile);
  });

  it('get throws on missing', async () => {
    await expect(meta.get('nonexistent')).rejects.toThrow('Meta not found');
  });

  it('get returns data without modifiedAt', async () => {
    await meta.save(metafile.id, metafile);
    await meta.touch(metafile.id, metafile);
    const retrieved = await meta.get(metafile.id);
    expect(retrieved).not.toHaveProperty('modifiedAt');
  });

  it('delete removes key', async () => {
    await meta.save(metafile.id, metafile);
    await meta.delete(metafile.id);
    await expect(meta.get(metafile.id)).rejects.toThrow('Meta not found');
  });

  it('list returns items with metadata', async () => {
    const file = { ...metafile, createdAt: '2026-01-01T00:00:00.000Z' };
    await meta.save(metafile.id, file);
    const list = await meta.list();
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      id: metafile.id,
      createdAt: '2026-01-01T00:00:00.000Z',
      modifiedAt: '2026-01-01T00:00:00.000Z'
    });
  });

  it('list with prefix filters', async () => {
    await meta.save(metafile.id, metafile);
    const list = await meta.list('nonexistent');
    expect(list.items).toHaveLength(0);
  });
});
