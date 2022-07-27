import * as rimraf from 'rimraf';
import { BinaryLike, BinaryToTextEncoding, createHash, randomBytes } from 'crypto';
import { createReadStream } from 'fs';

export function cleanup(directory: string): Promise<any> {
  return new Promise(resolve => rimraf(directory, resolve));
}

export const checksum = (
  buf: BinaryLike,
  algorithm = 'sha1',
  encoding: BinaryToTextEncoding = 'base64'
): string => {
  return createHash(algorithm).update(buf).digest(encoding);
};

export function base64toHex(base64: string): string {
  return Buffer.from(base64, 'base64').toString('hex');
}

export function hexToBase64(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64');
}

export function isMD5Hex(str: string): boolean {
  const regexExp = /^[a-f0-9]{32}$/gi;
  return regexExp.test(str);
}

export function randomString(length = 8): string {
  return randomBytes(length).toString('hex');
}

export function sha1sum(file: string, encoding: BinaryToTextEncoding = 'base64'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1');
    createReadStream(file, { flags: 'r' })
      .on('error', reject)
      .pipe(hash)
      .on('finish', () => resolve(hash.digest(encoding)));
  });
}
