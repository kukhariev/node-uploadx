import { createWriteStream, promises as fsp, WriteStream } from 'fs';
import { dirname, posix } from 'path';

/**
 * Ensures that the directory exists
 */
export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Ensures that the file exists and returns it size
 * @param path - filename or path to a local file
 * @param overwrite - force creating new empty file
 * @returns file size
 */
export async function ensureFile(path: string, overwrite = false): Promise<number> {
  await fsp.mkdir(dirname(path), { recursive: true });
  await (await fsp.open(path, overwrite ? 'w' : 'a')).close();
  return (await fsp.stat(path)).size;
}

export async function accessCheck(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Removes the specified file from the local file system
 */
export async function removeFile(path: string): Promise<void> {
  if (fsp.rm) return fsp.rm(path, { force: true });
  return fsp.unlink(path).catch((err: NodeJS.ErrnoException): void => {
    if (err.code !== 'ENOENT') throw err;
  });
}

/**
 * Truncates the file to the specified length. Used to undo chunk write operation.
 */
export function truncateFile(path: string, length = 0): Promise<void> {
  return fsp.truncate(path, length);
}

/**
 * Returns file WriteStream for data appending
 */
export function getWriteStream(path: string, start: number): WriteStream {
  return createWriteStream(path, { flags: 'r+', start });
}

/**
 * Return file paths that begin with the prefix
 */
export function getFiles(prefix: string): Promise<string[]> {
  const prefix_ = prefix.replace(/\\/g, '/');
  const _getFiles = async (current: string): Promise<string[]> => {
    try {
      if ((await fsp.stat(current)).isFile()) return _getFiles(dirname(current));
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
    return files.flat().filter(Boolean).sort() as string[];
  };
  return _getFiles(prefix_);
}

/**
 * @internal
 */
export { fsp };
