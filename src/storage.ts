import { createHash } from 'crypto';
import { Request } from 'express';
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
import { basename, dirname, join } from 'path';
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
function getuser_id(user: any): string {
  return user.id || user._id;
}
export class UploadxFile {
  metadata: any;
  destination: string;
  user_id: string;
  size: number;
  path: string;
  filename: string;
  id: string;
  created: Date;
  bytesWritten: number;

  constructor(data: Partial<UploadxFile>) {
    Object.assign(this, data);
    this.destination = dirname(this.path);
    this.filename = basename(this.path);

    try {
      mkdirSync(this.destination);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        this.destination = undefined;
      }
    }
    try {
      this.bytesWritten = statSync(this.path).size;
    } catch {
      this.bytesWritten = 0;
    }
  }

  write(buf: Buffer, start: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (this.bytesWritten === start) {
        appendFile(this.path, buf, { encoding: undefined }, err => {
          if (err) {
            reject(err);
          } else {
            this.bytesWritten += buf.length;
            resolve(this.bytesWritten);
          }
        });
      } else {
        resolve(this.bytesWritten);
      }
    });
  }
}

export class Store {
  files: UploadxFile[] = [];
  private json: string;
  private isDirty;
  private id: string;
  private setPath = (req: Request): string =>
    join(<string>this.destination, req.body.upload_id);

  constructor(public destination: string | ((req) => string) = tmpdir()) {
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

  create(req: Request): UploadxFile {
    const user_id = getuser_id(req.user);
    const size = +req.get('x-upload-content-length');
    const id = generateID({ ...req.body, user_id, size });
    req.body.upload_id = req.body.upload_id || id;
    if (typeof this.destination === 'function') {
      this.setPath = this.destination;
    }
    const path = this.setPath(req);
    const newFile = new UploadxFile({
      id,
      metadata: req.body,
      path,
      size,
      created: new Date(),
      user_id
    });
    log('%o', newFile);
    this.files = [
      ...this.files.filter(file => file.id !== newFile.id),
      ...[newFile]
    ];
    this.dumpToDisk();
    return newFile;
  }

  private reset() {
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
    const user_id = getuser_id(user);
    return this.files.filter(
      file => file.user_id === user_id && file.id === (id || file.id)
    );
  }
}
