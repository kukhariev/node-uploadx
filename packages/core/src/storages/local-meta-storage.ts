import { join } from 'path';
import { fsp, getFiles } from '../utils';
import { File } from './file';
import { ListObject, MetaStorage, MetaStorageOptions } from './meta-storage';
import { tmpdir } from 'os';

interface LocalMetaStorageOptions extends MetaStorageOptions {
  directory?: string;
  metaStoragePath?: string;
}

export class LocalMetaStorage<T extends File = File> extends MetaStorage<T> {
  public directory = '';

  constructor(readonly config?: LocalMetaStorageOptions) {
    super();

    this.directory =
      config?.metaStoragePath ||
      process.env.UPLOADX_META_DIR ||
      config?.directory ||
      join(tmpdir(), 'uploadx_meta');
  }

  getMetaPath = (name: string): string => `${this.directory}/${this.prefix + name + this.suffix}`;

  getNameFromPath = (metaFilePath: string): string =>
    metaFilePath.slice(`${this.directory}/${this.prefix}`.length, -this.suffix.length);

  async set(name: string, file: T): Promise<T> {
    await fsp.writeFile(this.getMetaPath(file.name), JSON.stringify(file, null, 2));
    return file;
  }

  async get(name: string): Promise<T> {
    const json = await fsp.readFile(this.getMetaPath(name), { encoding: 'utf8' });
    return JSON.parse(json) as T;
  }

  async remove(name: string): Promise<void> {
    await fsp.unlink(this.getMetaPath(name));
    return;
  }

  async list(prefix = ''): Promise<ListObject[]> {
    const list = [];
    const files = await getFiles(`${this.directory}/${this.prefix + prefix}`);
    for (const name of files) {
      name.endsWith(this.suffix) &&
        list.push({ name: this.getNameFromPath(name), updated: (await fsp.stat(name)).mtime });
    }
    return list;
  }
}
