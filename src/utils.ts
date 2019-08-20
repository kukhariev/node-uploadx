import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { promisify } from 'util';
import * as debug from 'debug';
export const logger = debug('uploadx');

export const fsMkdir = promisify(fs.mkdir);
export const fsClose = promisify(fs.close);
export const fsOpen = promisify(fs.open);
export const fsStat = promisify(fs.stat);
export const fsUnlink = promisify(fs.unlink);

export function isObject(value: any): boolean {
  return !!value && value.constructor === Object;
}

export function toHeaderString(x: any): string | undefined {
  if (!x) {
    return;
  }
  if (typeof x === 'string') {
    return x;
  }
  if (typeof x === 'number' || typeof x === 'boolean' || Array.isArray(x)) {
    return x.toString();
  }
  return;
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
/**
 * Return md5 checksum
 */
export function hashObject(data: any): string {
  let ordered = {} as any;
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

export async function getFileSize(filePath: string): Promise<number> {
  const { size } = await fsStat(filePath);
  return size;
}

/**
 * Parse the JSON body of an request
 */

export const typeis = (req: http.IncomingMessage, types: string[]): string | false => {
  const contentType = req.headers['content-type'] || '';
  return typeis.is(contentType, types);
};
typeis.is = (mime: string, types: string[] = ['/']): string | false => {
  const re = new RegExp(types.map(str => str.replace(/\*/g, '')).join('|'));
  return mime.search(re) !== -1 ? mime : false;
};
typeis.hasBody = (req: http.IncomingMessage): number | false => {
  const bodySize = Number(req.headers['content-length']);
  return !isNaN(bodySize) && bodySize;
};
export function getBody<T extends http.IncomingMessage>(req: T): Promise<Record<string, any>> {
  let limit = 10240;
  return new Promise((resolve, reject) => {
    if (!typeis(req, ['json'])) {
      return reject(new Error('ContentTypeError'));
    }
    if ('body' in req) {
      resolve((req as any).body);
    } else {
      const buffer: Buffer[] = [];
      req.on('data', chunk => {
        limit -= chunk.length;
        if (0 > limit) {
          return reject(new Error('BufferError'));
        }
        buffer.push(chunk);
      });
      req.once('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(buffer).toString());
          resolve(json);
        } catch (error) {
          reject(new Error('ParsingError'));
        }
      });
    }
  });
}

export function logMemoryUsage() {
  const { heapUsed } = process.memoryUsage();
  return (heapUsed / 1024 / 1024).toFixed(2);
}
