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

export function readBody(message: Readable, encoding = 'utf8', limit?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    message.setEncoding(encoding);
    message.on('data', chunk => {
      if (limit && body.length > limit) return reject('body length limit');
      body += chunk;
    });
    message.once('end', () => resolve(body));
  });
}

export async function getJsonBody(
  req: http.IncomingMessage,
  limit = 16777216
): Promise<Record<string, any>> {
  if (typeis.hasBody(req) > limit) return Promise.reject('body length limit');
  if ('body' in req) return req['body'];
  if (!typeis(req, ['json'])) return Promise.reject('content-type error');
  try {
    const raw = await readBody(req, 'utf8', limit);
    return JSON.parse(raw) as Record<string, any>;
  } catch (error) {
    return Promise.reject(error);
  }
}

export function getHeader(req: http.IncomingMessage, name: string): string {
  const raw = req.headers?.[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw || '';
}

export function setHeaders(
  res: http.ServerResponse,
  headers: Record<string, string | number> = {}
): void {
  const exposeHeaders = Object.keys(headers).toString();
  exposeHeaders && res.setHeader('Access-Control-Expose-Headers', exposeHeaders);
  for (const [key, value] of Object.entries(headers)) {
    ['location'].includes(key.toLowerCase())
      ? res.setHeader(key, encodeURI(value.toString()))
      : res.setHeader(key, value.toString());
  }
}

export function getBaseUrl(req: http.IncomingMessage): string {
  const proto = getHeader(req, 'x-forwarded-proto');
  const host = getHeader(req, 'host') || getHeader(req, 'x-forwarded-host');
  if (!host) return '';
  if (!proto) return `//${host}`;
  return `${proto}://${host}`;
}
