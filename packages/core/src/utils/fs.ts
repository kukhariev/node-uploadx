import { createWriteStream, promises as fsp, WriteStream } from 'fs';
import { dirname, resolve } from 'path';

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function ensureFile(path: string, overwrite = false): Promise<number> {
  await fsp.mkdir(dirname(path), { recursive: true });
  await (await fsp.open(path, overwrite ? 'w' : 'a')).close();
  return (await fsp.stat(path)).size;
}

export function getWriteStream(path: string, start: number): WriteStream {
  if (path && start >= 0) {
    return createWriteStream(path, { flags: 'r+', start });
  }
  throw new Error('getWriteStream: invalid parameters!');
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
  return Array.prototype.concat(...files) as string[];
}

export { fsp };
