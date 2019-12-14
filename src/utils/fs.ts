import { promises as fsp } from 'fs';
import { dirname, resolve } from 'path';

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function ensureFile(path: string, overwrite = false): Promise<number> {
  await fsp.mkdir(dirname(path), { recursive: true });
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
export async function getFiles(prefix: string): Promise<string[]> {
  try {
    if ((await fsp.stat(prefix)).isFile()) return [prefix];
  } catch {
    return [];
  }
  const dirents = await fsp.readdir(prefix, { withFileTypes: true });

  const files = await Promise.all(
    dirents.map(async dirent => {
      const path = resolve(prefix, dirent.name);
      return dirent.isDirectory() ? getFiles(path) : path;
    })
  );
  return Array.prototype.concat(...files);
}
export { fsp };
