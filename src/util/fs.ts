import * as fs from 'fs';
import { dirname, isAbsolute, join, normalize, parse, sep } from 'path';
import { promisify } from 'util';

export const fsMkdir = promisify(fs.mkdir);
export const fsClose = promisify(fs.close);
export const fsOpen = promisify(fs.open);
export const fsStat = promisify(fs.stat);
export const fsUnlink = promisify(fs.unlink);
export async function ensureDir(dir: string): Promise<void> {
  dir = normalize(dir);
  const paths = dir.split(sep);
  isAbsolute(dir) && paths.shift();
  let parent = parse(dir).root;
  for (const p of paths) {
    parent = join(parent, p);
    try {
      await fsMkdir(parent);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

export async function ensureFile(path: string, overwrite = false): Promise<number> {
  await ensureDir(dirname(path));
  await fsClose(await fsOpen(path, overwrite ? 'w' : 'a'));
  const { size } = await fsStat(path);
  return size;
}

/**
 * Resolve the Promise with file size or `-1` on error
 *
 * @param path
 */
export async function getFileSize(path: string): Promise<number> {
  try {
    return (await fsStat(path)).size;
  } catch {
    return -1;
  }
}
