import { randomBytes } from 'crypto';
import * as debug from 'debug';
import * as fs from 'fs';
import * as http from 'http';
import { dirname, isAbsolute, join, normalize, parse, sep } from 'path';
import { Readable } from 'stream';
import { promisify } from 'util';

export const logger = debug('uploadx');

export const RE_MATCH_MD5 = /^[a-f0-9]{32}$/i;

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

export const typeis = (req: http.IncomingMessage, types: string[]): string | false => {
  const contentType = req.headers['content-type'] || '';
  return typeis.is(contentType, types);
};
typeis.is = (mime: string, types: string[] = ['/']): string | false => {
  const re = new RegExp(types.map(str => str.replace(/[*+]/g, '')).join('|'));
  return mime.replace(/[*+]/g, '').search(re) !== -1 ? mime : false;
};
typeis.hasBody = (req: http.IncomingMessage): number | false => {
  const bodySize = Number(req.headers['content-length']);
  return !isNaN(bodySize) && bodySize;
};

export function readBody(message: Readable, encoding = 'utf8', limit = 16777216): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    message.setEncoding(encoding);
    message.on('data', chunk => {
      if (body.length > limit) return reject('body length limit');
      body += chunk;
    });
    message.once('end', () => resolve(body));
  });
}

export async function getJsonBody(req: http.IncomingMessage): Promise<Record<string, any>> {
  if (!typeis(req, ['json'])) return Promise.reject('content-type error');
  if ('body' in req) return (req as any).body;
  try {
    const raw = await readBody(req);
    return JSON.parse(raw);
  } catch (error) {
    return Promise.reject(error);
  }
}

export const pick = <T, K extends keyof T>(obj: T, whitelist: K[]): Pick<T, K> => {
  const result: any = {};
  whitelist.forEach(key => (result[key] = obj[key]));
  return result;
};

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
