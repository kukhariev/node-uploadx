import { createHash } from 'crypto';
import {
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFile,
  appendFile,
  statSync,
  mkdir
} from 'fs';
import { join, resolve, basename, dirname } from 'path';
import { homedir, tmpdir } from 'os';
import { inspect } from 'util';
import debug = require('debug');
const log = debug('uploadx:storage');
const debounceTime = 3000;

export interface UploadXOptions {
  metadata;
  user;
  size: number;
  mimetype: string;
}

export class UploadXFile implements UploadXOptions {
  metadata;
  private _destination;
  user;
  size: number;
  path: string;
  filename: string;
  id: string;
  mimetype;
  created: Date;
  bytesWritten: number;
  public get destination() {
    return this._destination;
  }
  public set destination(value) {
    if (typeof value === 'string') {
      this.filename = this.id;
      this.path = resolve(value, this.id);
      this._destination = value;
    } else if (typeof value === 'function') {
      this.path = value(this);
      this.filename = basename(this.path);
      this._destination = dirname(this.path);
    } else {
      throw new TypeError(
        `Destination must be a string or function. Received ${inspect(value)}`
      );
    }
    try {
      mkdirSync(this._destination);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        this._destination = undefined;
      }
    }
  }

  constructor(data: Partial<UploadXFile>) {
    Object.assign(this, data);
    try {
      this.bytesWritten = statSync(this.path).size;
    } catch {
      this.bytesWritten = 0;
    }
    this.created = new Date();
  }
}

/**
 * Uploads db
 */
export class Store {
  map: UploadXFile[] = [];
  private json: string;
  private isWaitToSave;

  /**
   * Creates an instance of uploads db.
   * @param [destination]
   * @param [name]
   */
  constructor(public destination: string | Function = tmpdir()) {
    const storageDir = `${process.env.XDG_CONFIG_HOME ||
      join(homedir(), '.config', 'uploadx')}`;
    const hash = createHash('md5')
      .update(this.destination.toString() + process.env.NODE_ENV)
      .digest('hex');
    this.json = join(storageDir, `${hash}.json`);
    mkdir(storageDir, err => {
      if (err && err.code !== 'EEXIST') {
        throw err;
      }
    });

    try {
      JSON.parse(readFileSync(this.json).toString()).forEach(el => {
        this.map.push(new UploadXFile(el));
      });
      log(`read data from ${this.json}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.reset();
      }
    }
  }

  create(data: UploadXOptions): UploadXFile {
    const id = createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
    const file = new UploadXFile({
      ...data,
      id,
      destination: this.destination
    });
    this.map = [...this.map.filter(el => el.id !== id), ...[file]];
    this.save();
    return file;
  }

  write(file: UploadXFile, buf: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      if (file.bytesWritten >= file.size) {
        resolve(file.bytesWritten);
      } else {
        appendFile(file.path, buf, { encoding: undefined }, err => {
          if (err) {
            reject(err);
          } else {
            file.bytesWritten = file.bytesWritten + buf.length;
            resolve(file.bytesWritten);
          }
        });
      }
    });
  }

  reset() {
    try {
      unlinkSync(this.json);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    this.map = [];
  }

  save() {
    if (this.isWaitToSave) {
      return;
    } else {
      this.isWaitToSave = setTimeout(() => {
        writeFile(this.json, JSON.stringify(this.map, undefined, 2), err => {
          if (err) {
            log(err.message);
          }
        });
        clearTimeout(this.isWaitToSave);
        this.isWaitToSave = undefined;
      }, debounceTime);
    }
  }

  remove(id: string) {
    this.map = this.map.filter(el => el.id !== id);
    this.save();
  }

  findById(id: string) {
    return this.map.find(el => el.id === id);
  }

  find(query?: any) {
    if (query) {
      return this.map.filter(v =>
        Object.keys(query).every(k => String(v[k]) === String(query[k]))
      );
    }
    return this.map;
  }
}
