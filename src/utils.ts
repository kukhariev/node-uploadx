import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { ERRORS, UploadXError } from './core';
export const fsMkdir = promisify(fs.mkdir);
export const fsClose = promisify(fs.close);
export const fsOpen = promisify(fs.open);
export const fsStat = promisify(fs.stat);
export const fsUnlink = promisify(fs.unlink);

/**
 * Return md5 checksum
 * @param data
 */
export function hashObject(data: any) {
  return createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
}
/**
 * Ensures that the file exists.
 * @param filePath
 * @param overwrite if true: reset file
 */
export async function ensureFile(filePath: string, overwrite = false) {
  try {
    await ensureDir(path.dirname(filePath));
    await fsClose(await fsOpen(filePath, overwrite ? 'w' : 'a'));
  } catch (error) {
    throw new UploadXError(ERRORS.FILE_WRITE_ERROR, error);
  }
}

export async function ensureDir(dir: string) {
  dir = path.normalize(dir);
  const paths = dir.split(path.sep);
  path.isAbsolute(dir) && paths.shift();
  let parent = path.parse(dir).root;
  for (const p of paths) {
    parent = path.join(parent, p);
    try {
      await fsMkdir(parent);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
