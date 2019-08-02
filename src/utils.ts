import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { promisify, isObject } from 'util';

export const fsMkdir = promisify(fs.mkdir);
export const fsClose = promisify(fs.close);
export const fsOpen = promisify(fs.open);
export const fsStat = promisify(fs.stat);
export const fsUnlink = promisify(fs.unlink);

/**
 * Return md5 checksum
 */
export function hashObject(data: any): string {
  let ordered = {};
  if (isObject(data)) {
    Object.keys(data)
      .sort()
      .forEach(key => {
        ordered[key] = data[key];
      });
  } else {
    ordered = data;
  }
  return createHash('md5')
    .update(JSON.stringify(ordered))
    .digest('hex');
}

/**
 * Ensures that the file exists.
 */
export async function ensureFile(filePath: string, overwrite = false): Promise<number> {
  await ensureDir(path.dirname(filePath));
  await fsClose(await fsOpen(filePath, overwrite ? 'w' : 'a'));
  const { size } = await fsStat(filePath);
  return size;
}

export async function ensureDir(dir: string): Promise<void> {
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

export async function getFileSize(filePath: string): Promise<number> {
  const fileStat = await fsStat(filePath);
  return fileStat.size;
}

/**
 * Parse the JSON body of an request
 */
export function getBody<T extends http.IncomingMessage>(req: T): Promise<object> {
  return new Promise(resolve => {
    if ('body' in req) {
      resolve(req['body']);
    } else {
      const buffer: Buffer[] = [];
      req.on('data', (chunk: Buffer) => buffer.push(chunk));
      req.on('end', () => {
        req['body'] = JSON.parse(buffer.concat().toString());
        resolve(req['body']);
      });
    }
  });
}
