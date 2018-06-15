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

export class UploadxFile {
  metadata: any;
  private _destination: string;
  user;
  size: number;
  path: string;
  filename: string;
  id: string;
  mimetype: string;
  created: Date;
  bytesWritten: number;
  public get destination() {
    return this._destination;
  }
  public set destination(value: string | Function) {
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

  constructor(data: Partial<UploadxFile>) {
    Object.assign(this, data);
    try {
      this.bytesWritten = statSync(this.path).size;
    } catch {
      this.bytesWritten = 0;
    }
    this.created = this.created || new Date();
  }
}

export class Store {
  data: UploadxFile[] = [];
  private json: string;
  private isDirty;
  id: string;

  constructor(public destination: string | Function = tmpdir()) {
    const storageDir = `${process.env.XDG_CONFIG_HOME ||
      join(homedir(), '.config', 'uploadx')}`;
    this.id = createHash('md5')
      .update(this.destination.toString() + process.env.NODE_ENV)
      .digest('hex');
    this.json = join(storageDir, `${this.id}.json`);
    mkdir(storageDir, err => {
      if (err && err.code !== 'EEXIST') {
        throw err;
      }
    });

    try {
      <UploadxFile[]>JSON.parse(
        readFileSync(this.json, 'utf8').toString(),
        (key, value) => {
          return key === 'created' ? new Date(value) : value;
        }
      ).forEach(entry => {
        this.data.push(new UploadxFile(entry));
      });
      log(`read data from ${this.json}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        log('reset store:', err.message);
        this.reset();
      }
    }
  }

  create(data: {
    metadata: any;
    user: any;
    size: number;
    mimetype: string;
  }): UploadxFile {
    const id = createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
    const file = new UploadxFile({
      ...data,
      id,
      destination: this.destination
    });
    this.data = [...this.data.filter(el => el.id !== id), ...[file]];
    this.dumpToDisk();
    return file;
  }

  write(file: UploadxFile, buf: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      if (file.bytesWritten >= file.size) {
        resolve(file.bytesWritten);
      } else {
        appendFile(file.path, buf, { encoding: undefined }, err => {
          if (err) {
            reject(err);
          } else {
            file.bytesWritten += buf.length;
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
    this.data = [];
  }

  private dumpToDisk() {
    if (this.isDirty) {
      return;
    }
    this.isDirty = setTimeout(() => {
      writeFile(this.json, JSON.stringify(this.data, undefined, '\t'), err => {
        if (err) {
          log(err.message);
        }
      });
      clearTimeout(this.isDirty);
      this.isDirty = false;
    }, debounceTime);
  }

  remove(id: string) {
    this.data = this.data.filter(el => el.id !== id);
    this.dumpToDisk();
  }

  findById(id: string) {
    return this.data.find(el => el.id === id);
  }

  find(query?: Partial<UploadxFile>) {
    if (query) {
      return this.data.filter(v =>
        Object.keys(query).every(
          key => JSON.stringify(v[key]) === JSON.stringify(query[key])
        )
      );
    }
    return this.data;
  }
}
