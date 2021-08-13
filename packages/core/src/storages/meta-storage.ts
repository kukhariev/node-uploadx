export interface ListObject {
  name: string;
  updated?: Date | number | string;
}
export interface MetaStorageOptions {
  prefix?: string;
  suffix?: string;
}
export class MetaStorage<T> {
  prefix = '';
  suffix = METAFILE_EXTNAME;
  constructor(readonly config?: MetaStorageOptions) {
    this.prefix = config?.prefix ?? '';
    this.suffix = config?.suffix ?? METAFILE_EXTNAME;
  }

  async set(name: string, file: T): Promise<T> {
    return file;
  }

  async remove(name: string): Promise<void> {
    return;
  }

  async get(name: string): Promise<T> {
    return Promise.reject();
  }

  async list(prefix: string): Promise<ListObject[]> {
    return Promise.reject();
  }
}

export const METAFILE_EXTNAME = '.META';
