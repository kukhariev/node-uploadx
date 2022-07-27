import { Transform } from 'stream';
import { BinaryToTextEncoding, createHash, Hash } from 'crypto';
import { Cache } from './cache';
import { createReadStream } from 'fs';

export class RangeChecksum extends Transform {
  hash: Hash;
  readonly _hash: Hash;

  constructor(readonly path: string) {
    super();
    this.hash = hashes.get(path) || createHash(hashes.algorithm);
    this._hash = this.hash.copy();
  }

  reset(): void {
    hashes.set(this.path, this._hash);
  }

  digest(encoding: BinaryToTextEncoding = 'hex'): string {
    return this.hash.copy().digest(encoding);
  }

  _transform(chunk: Buffer, encoding: string, done: () => void): void {
    this.push(chunk);
    this.hash.update(chunk);
    done();
  }

  _flush(cb: (err?: Error) => void): void {
    cb();
  }
}

export class RangeHasher extends Cache<Hash> {
  public algorithm: 'sha1' | 'md5' = 'sha1';

  hex(path: string): string {
    return this.get(path)?.copy().digest('hex') || '';
  }

  base64(path: string): string {
    return this.get(path)?.copy().digest('base64') || '';
  }

  async init(path: string, start = 0): Promise<Hash> {
    return this.get(path)?.copy() || this.updateFromFs(path, start);
  }

  digester(path: string): RangeChecksum {
    return new RangeChecksum(path);
  }

  async updateFromFs(path: string, start = 0, initial?: Hash): Promise<Hash> {
    const hash = await this._fromFs(path, start, initial);
    return this.set(path, hash);
  }

  private _fromFs(path: string, start = 0, initial?: Hash): Promise<Hash> {
    return new Promise((resolve, reject) => {
      const digester = this.digester(path);
      initial && (digester.hash = initial);
      createReadStream(path, { start })
        .on('error', reject)
        .on('end', () => resolve(digester.hash))
        .pipe(digester)
        .resume();
    });
  }
}

export const hashes = new RangeHasher();
