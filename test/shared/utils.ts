import * as rimraf from 'rimraf';
import { BinaryLike, BinaryToTextEncoding, createHash } from 'crypto';

export function cleanup(directory: string): Promise<any> {
  return new Promise(resolve => rimraf(directory, resolve));
}

export const hash = (
  buf: BinaryLike,
  algorithm = 'sha1',
  encoding: BinaryToTextEncoding = 'base64'
): string => {
  return createHash(algorithm).update(buf).digest(encoding);
};
