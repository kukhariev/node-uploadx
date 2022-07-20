import { PassThrough, Transform } from 'stream';
import { BinaryToTextEncoding, createHash, Hash } from 'crypto';

export class StreamLength extends Transform {
  length = 0;

  constructor(readonly limit: number = Infinity) {
    super();
  }

  _transform(chunk: Buffer, encoding: string, cb: (err?: Error) => void): void {
    const expected = this.length + chunk.length;
    if (this.limit >= expected) {
      this.push(chunk);
      this.length = expected;
      cb();
    } else {
      // this.emit('streamLengthError', new Error('Stream length limit exceeded'));
      cb(new Error('Stream length limit exceeded'));
    }
  }
}

export function streamLength(limit = Infinity): StreamLength {
  return new StreamLength(limit);
}

export class StreamChecksum extends Transform {
  length = 0;
  digest = '';
  hash: Hash;

  constructor(
    readonly checksum: string,
    readonly algorithm: string,
    readonly encoding: BinaryToTextEncoding = 'base64'
  ) {
    super();
    this.hash = createHash(algorithm);
  }

  _transform(chunk: Buffer, encoding: string, done: () => void): void {
    this.push(chunk);
    this.hash.update(chunk);
    this.length += chunk.length;
    done();
  }

  _flush(cb: (err?: Error) => void): void {
    this.digest = this.hash.digest(this.encoding);
    if (this.checksum && this.checksum !== this.digest) {
      cb(new Error('Checksum mismatch'));
    } else {
      cb();
    }
  }
}

export function streamChecksum(
  checksum = '',
  algorithm?: string,
  encoding: BinaryToTextEncoding = 'base64'
): StreamChecksum | PassThrough {
  return algorithm ? new StreamChecksum(checksum, algorithm, encoding) : new PassThrough();
}
