import { promises as fsp } from 'fs';
import { dirname, isAbsolute, join, normalize, parse, sep } from 'path';

export async function ensureDir(dir: string): Promise<void> {
  dir = normalize(dir);
  const paths = dir.split(sep);
  isAbsolute(dir) && paths.shift();
  let parent = parse(dir).root;
  for (const p of paths) {
    parent = join(parent, p);
    try {
      await fsp.mkdir(parent);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

export async function ensureFile(path: string, overwrite = false): Promise<number> {
  await ensureDir(dirname(path));
  await (await fsp.open(path, overwrite ? 'w' : 'a')).close();
  const { size } = await fsp.stat(path);
  return size;
}

/**
 * Resolve the Promise with file size or `-1` on error
 *
 * @param path
 */
export async function getFileSize(path: string): Promise<number> {
  try {
    return (await fsp.stat(path)).size;
  } catch {
    return -1;
  }
}

export { fsp };
