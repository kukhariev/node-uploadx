import { File } from './file';
import { LocalMetaStorage } from './local-meta-storage';
import { MetaStorage } from './meta-storage';

/**
 * Creates a metadata storage instance based on the provided options.
 */
export function createMetaStorage<T extends File = File>(
  options: {
    metaStorage?: MetaStorage<T>;
    metaDir?: string;
    uploadDir?: string;
    directory?: string;
    metaStorageOptions?: unknown;
    metaStorageConfig?: unknown;
  },
  metaStorageConstructor?: new (opts: Record<string, unknown>) => MetaStorage<T>
): MetaStorage<T> {
  if (options.metaStorage) return options.metaStorage;

  const metaOpts = options.metaStorageOptions ?? options.metaStorageConfig;
  const mergedOptions = { ...options, ...(metaOpts as Record<string, unknown>) };

  if (options.metaDir) {
    return new LocalMetaStorage({ ...mergedOptions, directory: options.metaDir });
  }

  if ('directory' in mergedOptions) {
    return new LocalMetaStorage(mergedOptions);
  }

  if (metaStorageConstructor) {
    return new metaStorageConstructor(mergedOptions);
  }

  return new LocalMetaStorage({
    directory: options.uploadDir ?? options.directory ?? ''
  });
}
