import { createHash } from 'crypto';
import {
  appendFile,
  mkdir,
  mkdirSync,
  readFileSync,
  statSync,
  unlink,
  writeFile
} from 'fs';
import { homedir, tmpdir } from 'os';
import { basename, dirname, join, resolve } from 'path';
import { inspect } from 'util';
import debug = require('debug');
const log = debug('uploadx:storage');

const debounceTime = 3000;

// Session expired after 7 days
const sessionTimeout = 24 * 60 * 60 * 1000 * 7;

function generateID(data: any) {
  return createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
}
type User = { id: string; [key: string]: any };
function normalizeUserObject(user: any, allowed?: string[]): User {
  const normalized = { id: user.id || user._id };
  allowed = allowed || [];
  for (const key of allowed) {
    normalized[key] = user[key];
  }
  return normalized;
}
export class UploadxFile {
  metadata: any;
  private _destination: string;
  user: User;
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
  public set destination(value: string | ((file: UploadxFile) => string)) {
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
    this.user = normalizeUserObject(this.user, ['name']);
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
  }

  write(buf: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      if (this.bytesWritten + buf.length <= this.size) {
        appendFile(this.path, buf, { encoding: undefined }, err => {
          if (err) {
            reject(err);
          } else {
            this.bytesWritten += buf.length;
            resolve(this.bytesWritten);
          }
        });
      } else {
        unlink(this.path, () => {
          this.bytesWritten = 0;
          reject(new Error('File Error'));
        });
      }
    });
  }
}

export class Store {
  files: UploadxFile[] = [];
  private json: string;
  private isDirty;
  private id: string;

  constructor(
    public destination: string | ((file: UploadxFile) => string) = tmpdir()
  ) {
    const storageDir = `${process.env.XDG_CONFIG_HOME ||
      join(homedir(), '.config', 'uploadx')}`;
    this.id = generateID(this.destination.toString() + process.env.NODE_ENV);
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
        this.files.push(new UploadxFile(entry));
      });
      log(`read data from ${this.json}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        log('reset store:', err.message);
        this.reset();
      }
    }
  }
  private dumpToDisk() {
    if (this.isDirty) {
      return;
    }
    this.isDirty = setTimeout(() => {
      this.removeExpired();
      writeFile(this.json, JSON.stringify(this.files, undefined, '\t'), err => {
        if (err) {
          log(err.message);
        }
      });
      clearTimeout(this.isDirty);
      this.isDirty = false;
    }, debounceTime);
  }

  private removeExpired() {
    this.files.forEach((file, i) => {
      if (Date.now() - sessionTimeout > file.created.getTime()) {
        if (file.bytesWritten) {
          unlink(file.path, () => {});
        }
        this.files.splice(i, 1);
        log('Deleted expired session %o', file);
      }
    });
  }

  create(data: {
    metadata: any;
    user: any;
    size: number;
    mimetype: string;
  }): UploadxFile {
    const newFile = new UploadxFile({
      ...data,
      id: generateID({ ...data, user: normalizeUserObject(data.user) }),
      created: new Date(),
      destination: this.destination
    });
    log('%o', newFile);
    this.files = [
      ...this.files.filter(file => file.id !== newFile.id),
      ...[newFile]
    ];
    this.dumpToDisk();
    return newFile;
  }

  reset() {
    this.files = [];
    unlink(this.json, err => {
      if (err && err.code !== 'ENOENT') {
        log(err);
      }
    });
  }

  remove(id: string) {
    this.files = this.files.filter(file => file.id !== id);
    this.dumpToDisk();
  }

  findById(id: string) {
    return this.files.find(file => file.id === id);
  }

  findByUser(user, id?) {
    const userID = normalizeUserObject(user).id;
    return this.files.filter(
      file => file.user.id === userID && file.id === (id || file.id)
    );
  }
}
