import { randomBytes } from 'crypto';
import * as debug from 'debug';
import * as fs from 'fs';
import * as http from 'http';
import { normalize, sep, isAbsolute, parse, join, dirname } from 'path';
import { promisify } from 'util';

export const logger = debug('uploadx');

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

/**
 * Create file if not exists.
 * Resolve the Promise with file size
 *
 * @param path
 * @param overwrite
 */
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
      return reject('ContentType Error');
    }
    if ('body' in req) {
      resolve((req as any).body);
    } else {
      const buffer: Buffer[] = [];
      req.on('data', chunk => {
        limit -= chunk.length;
        if (0 > limit) {
          return reject('Buffer Error');
        }
        buffer.push(chunk);
      });
      req.once('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(buffer).toString());
          resolve(json);
        } catch (error) {
          reject('Parsing Error');
        }
      });
    }
  });
}

export function memUsage(): string {
  const { heapUsed } = process.memoryUsage();
  return (heapUsed / 1024 / 1024).toFixed(2);
}

export const pick = <T, K extends keyof T>(obj: T, whitelist: K[]): Pick<T, K> => {
  const result: any = {};
  whitelist.forEach(key => (result[key] = obj[key]));
  return result;
};
export const cp = (obj: any, query: any): boolean => {
  for (const key in query) {
    const value = query[key];
    if ((typeof value !== 'object' && value === null) || value !== undefined) {
      if (value !== obj[key]) return false;
    }
  }
  return true;
};

export const find = <T>(list: T[], query: Partial<T>): T[] => list.filter(obj => cp(obj, query));

export function getHeader(req: http.IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw || '';
}

export function getBaseUrl(req: http.IncomingMessage): string {
  const proto = getHeader(req, 'x-forwarded-proto');
  const host = getHeader(req, 'host') || getHeader(req, 'x-forwarded-host');
  if (!host) return '';
  if (!proto) return '//' + host;
  return proto + '://' + host;
}
export const uid = (): string => randomBytes(16).toString('hex');

/**
 * 32-bit FNV-1a hash function
 */
export function fnv(str: string): number {
  let hash = 2166136261;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}
