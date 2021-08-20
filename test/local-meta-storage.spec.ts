import { LocalMetaStorage } from '@uploadx/core';
import * as path from 'path';

describe('LocalMetaStorage', () => {
  it('defaults', () => {
    const meta = new LocalMetaStorage();
    const metaPath = meta.getMetaPath('name.ext');
    expect(path.basename(metaPath)).toBe('name.ext.META');
    expect(meta.getNameFromPath(metaPath)).toBe('name.ext');
  });

  it('custom', () => {
    const meta = new LocalMetaStorage({ prefix: '.', suffix: '.', directory: './meta' });
    const metaPath = meta.getMetaPath('name.ext');
    expect(metaPath).toBe('./meta/.name.ext.');
    expect(meta.getNameFromPath(metaPath)).toBe('name.ext');
  });
});
