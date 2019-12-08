import * as http from 'http';
import { Readable } from 'stream';

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

export function getHeader(req: http.IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw || '';
}

export function getBaseUrl(req: http.IncomingMessage): string {
  const proto = getHeader(req, 'x-forwarded-proto');
  const host = getHeader(req, 'host') || getHeader(req, 'x-forwarded-host');
  if (!host) return '';
  if (!proto) return `//${host}`;
  return `${proto}://${host}`;
}
