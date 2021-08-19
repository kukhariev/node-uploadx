import { join } from 'path';
import { fsp, getFiles } from '../utils';
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
    this.directory =
      process.env.UPLOADX_META_DIR || config?.directory || join(tmpdir(), 'uploadx_meta');
  }

  /**
   * Returns metafile path
   * @param name - upload name
   */
  getMetaPath = (name: string): string => `${this.directory}/${this.prefix + name + this.suffix}`;

  /**
   * Returns upload name from metafile path
   * @internal
   */
  getNameFromPath = (metaFilePath: string): string =>
    metaFilePath.slice(`${this.directory}/${this.prefix}`.length, -this.suffix.length);

  async save(name: string, file: T): Promise<T> {
    await fsp.writeFile(this.getMetaPath(file.name), JSON.stringify(file, null, 2));
    return file;
  }

  async get(name: string): Promise<T> {
    const json = await fsp.readFile(this.getMetaPath(name), { encoding: 'utf8' });
    return JSON.parse(json) as T;
  }

  async delete(name: string): Promise<void> {
    await fsp.unlink(this.getMetaPath(name));
    return;
  }

  async list(prefix = ''): Promise<UploadList> {
    const uploads = [];
    const files = await getFiles(`${this.directory}/${this.prefix + prefix}`);
    for (const name of files) {
      name.endsWith(this.suffix) &&
        uploads.push({
          name: this.getNameFromPath(name),
          created: (await fsp.stat(name)).ctime
        });
    }
    return { items: uploads };
  }
}
