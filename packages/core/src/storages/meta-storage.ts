export interface UploadList {
  items: {
    name: string;
    updated?: Date | number | string;
  }[];
}

export interface MetaStorageOptions {
  prefix?: string;
  suffix?: string;
}
/**
 * Stores upload metadata
 */
export class MetaStorage<T> {
  prefix = '';
  suffix = METAFILE_EXTNAME;
  constructor(readonly config?: MetaStorageOptions) {
    this.prefix = config?.prefix ?? '';
    this.suffix = config?.suffix ?? METAFILE_EXTNAME;
  }

  /**
   * Saves upload metadata
   */
  async save(name: string, file: T): Promise<T> {
    return file;
  }

  /**
   * Deletes an upload metadata
   */
  async delete(name: string): Promise<void> {
    return;
  }

  /**
   * Retrieves upload metadata
   */
  async get(name: string): Promise<T> {
    return Promise.reject();
  }

  /**
   * Retrieves a list of uploads whose names begin with the prefix
   */
  async list(prefix = ''): Promise<UploadList> {
    return { items: [] };
  }
}
/**
 *
 */
export const METAFILE_EXTNAME = '.META';
