import {
  createMetaStorage,
  File,
  LocalMetaStorage,
  MetaStorage,
  MetaStorageOptions
} from '../packages/core/src';

class TestMetaStorage extends MetaStorage<File> {
  constructor(opts: Record<string, unknown>) {
    super(opts as MetaStorageOptions);
  }
}

describe('createMetaStorage', () => {
  it('returns metaStorage as-is', () => {
    const meta = new MetaStorage<File>();
    expect(createMetaStorage({ metaStorage: meta })).toBe(meta);
  });

  it('creates LocalMetaStorage with metaDir', () => {
    const meta = createMetaStorage({ metaDir: '/custom/path' });
    expect(meta).toBeInstanceOf(LocalMetaStorage);
    expect((meta as LocalMetaStorage).directory).toBe('/custom/path');
  });

  it('creates LocalMetaStorage with metaStorageOptions.directory', () => {
    const meta = createMetaStorage({ metaStorageOptions: { directory: '/opt/path' } });
    expect(meta).toBeInstanceOf(LocalMetaStorage);
    expect((meta as LocalMetaStorage).directory).toBe('/opt/path');
  });

  it('creates LocalMetaStorage with deprecated metaStorageConfig.directory', () => {
    const meta = createMetaStorage({ metaStorageConfig: { directory: '/old/path' } });
    expect(meta).toBeInstanceOf(LocalMetaStorage);
    expect((meta as LocalMetaStorage).directory).toBe('/old/path');
  });

  it('metaDir overrides metaStorageOptions.directory', () => {
    const meta = createMetaStorage({
      metaDir: '/override',
      metaStorageOptions: { directory: '/ignored' }
    });
    expect((meta as LocalMetaStorage).directory).toBe('/override');
  });

  it('metaDir overrides metaStorageConfig.directory', () => {
    const meta = createMetaStorage({
      metaDir: '/override',
      metaStorageConfig: { directory: '/ignored' }
    });
    expect((meta as LocalMetaStorage).directory).toBe('/override');
  });

  it('uses metaStorageConstructor when no local indicators', () => {
    const meta = createMetaStorage({}, TestMetaStorage);
    expect(meta).toBeInstanceOf(TestMetaStorage);
  });

  it('falls back to LocalMetaStorage when no constructor', () => {
    const meta = createMetaStorage({});
    expect(meta).toBeInstanceOf(LocalMetaStorage);
  });

  it('falls back to uploadDir for LocalMetaStorage directory', () => {
    const meta = createMetaStorage({ uploadDir: '/uploads' });
    expect(meta).toBeInstanceOf(LocalMetaStorage);
    expect((meta as LocalMetaStorage).directory).toBe('/uploads');
  });

  it('uses deprecated directory when uploadDir also set', () => {
    const meta = createMetaStorage({ uploadDir: '/new', directory: '/old' });
    expect((meta as LocalMetaStorage).directory).toBe('/old');
  });
});
