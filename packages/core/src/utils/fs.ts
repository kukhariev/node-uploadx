import { createWriteStream, promises as fsp, WriteStream } from 'fs';
import { dirname, posix } from 'path';

/**
 * Ensures that the directory exists
 * @param dir
 */
export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Ensures that the file exists and returns it size
 * @param path
 * @param overwrite Force creating new empty file
 * @returns file size
 */
export async function ensureFile(path: string, overwrite = false): Promise<number> {
  await fsp.mkdir(dirname(path), { recursive: true });
  await (await fsp.open(path, overwrite ? 'w' : 'a')).close();
  return (await fsp.stat(path)).size;
}

/**
 * Returns file WriteStream for data appending.
 * @param path
 * @param start
 */
export function getWriteStream(path: string, start: number): WriteStream {
  if (path && start >= 0) {
    return createWriteStream(path, { flags: 'r+', start });
  }
  throw new Error('getWriteStream: invalid parameters!');
}

/**
 * Return file paths that begin with the prefix
 * @param prefix
 */
export function getFiles(prefix: string): Promise<string[]> {
  const prefix_ = prefix.replace(/\\/g, '/');
  const _getFiles = async (current: string): Promise<string[]> => {
    try {
      if ((await fsp.stat(current)).isFile()) return [current];
    } catch {
      return _getFiles(dirname(current));
    }
    const dirents = await fsp.readdir(current, { withFileTypes: true });
    const files = await Promise.all(
      dirents.map(async dirent => {
        const path = posix.join(current, dirent.name);
        return path.startsWith(prefix_) ? (dirent.isDirectory() ? _getFiles(path) : path) : null;
      })
    );
    return Array.prototype
      .concat(...files)
      .filter(Boolean)
      .sort() as string[];
  };
  return _getFiles(prefix_);
}

export { fsp };
