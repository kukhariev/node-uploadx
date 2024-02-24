import * as rimraf from 'rimraf';
import { BinaryLike, BinaryToTextEncoding, createHash } from 'crypto';

export function cleanup(directory: string): Promise<boolean> {
  return rimraf.rimraf(directory);
}

export const hash = (
  buf: BinaryLike,
  algorithm = 'sha1',
  encoding: BinaryToTextEncoding = 'base64'
): string => {
  return createHash(algorithm).update(buf).digest(encoding);
};

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}
