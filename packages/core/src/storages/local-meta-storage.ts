import { join } from 'path';
import { accessCheck, fsp, getFiles, removeFile } from '../utils';
import { File } from './file';
import { MetaStorage, MetaStorageOptions, UploadList } from './meta-storage';
import { tmpdir } from 'os';

export interface LocalMetaStorageOptions extends MetaStorageOptions {
  /**
   * Where the upload metadata should be stored
   */
  directory?: string;
}

/**
 * Stores upload metafiles on local disk
 */
export class LocalMetaStorage<T extends File = File> extends MetaStorage<T> {
  readonly directory: string;

  constructor(config?: LocalMetaStorageOptions) {
    super(config);
    this.directory = (config?.directory || join(tmpdir(), 'uploadx_meta')).replace(/\\/g, '/');
    this.accessCheck().catch(err => {
      this.logger.error('Metadata storage access check failed: %O', err);
    });
  }

  /**
   * Returns metafile path
   * @param id - upload id
   */
  getMetaPath = (id: string): string => `${this.directory}/${this.prefix + id + this.suffix}`;

  /**
   * Returns upload id from metafile path
   * @internal
   */
  getIdFromPath = (metaFilePath: string): string =>
    metaFilePath.slice(`${this.directory}/${this.prefix}`.length, -this.suffix.length);

  async save(id: string, file: T): Promise<T> {
    await fsp.writeFile(this.getMetaPath(id), JSON.stringify(file, null, 2));
    return file;
  }

  async touch(id: string, file: T): Promise<T> {
    const time = new Date();
    await fsp.utimes(this.getMetaPath(id), time, time);
    return file;
  }

  async get(id: string): Promise<T> {
    const json = await fsp.readFile(this.getMetaPath(id), { encoding: 'utf8' });
    return JSON.parse(json) as T;
  }

  async delete(id: string): Promise<void> {
    await removeFile(this.getMetaPath(id));
    return;
  }

  async list(prefix = ''): Promise<UploadList> {
    const uploads = [];
    const files = await getFiles(`${this.directory}/${this.prefix + prefix}`);
    for (const name of files) {
      if (name.endsWith(this.suffix)) {
        const { birthtime, ctime, mtime } = await fsp.stat(name);
        const id = this.getIdFromPath(name);
        uploads.push({ id, createdAt: birthtime || ctime, modifiedAt: mtime });
      }
    }
    return { items: uploads };
  }

  private accessCheck(): Promise<void> {
    return accessCheck(this.directory);
  }
}
