import * as http from 'http';
import { Readable } from 'stream';
import { Metadata } from '../storages';

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

export async function readBody(
  message: Readable,
  encoding = 'utf8',
  limit?: number
): Promise<string> {
  let body = '';
  message.setEncoding(encoding);
  for await (const chunk of message) {
    body += chunk;
    if (limit && body.length > limit) return Promise.reject('body length limit');
  }
  return body;
}

export async function getMetadata(
  req: http.IncomingMessage & { body?: Metadata },
  limit = 16777216
): Promise<Metadata> {
  if (typeis.hasBody(req) > limit) return Promise.reject('body length limit');
  if (req.body) return req.body;
  if (!typeis(req, ['json'])) return Promise.reject('content-type error');
  const raw = await readBody(req, 'utf8', limit);
  return JSON.parse(raw) as Metadata;
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

export type Headers = Record<string, string | number>;

export interface UploadxResponse<T = ResponseBody> extends Record<string, any> {
  statusCode?: number;
  headers?: Headers;
  body?: T;
}
export type ResponseBody = string | Record<string, any>;
export type ResponseBodyType = 'text' | 'json';
export type ResponseTuple<T = ResponseBody> = [statusCode: number, body?: T, headers?: Headers];

export function responseToTuple<T>(response: UploadxResponse<T>): ResponseTuple {
  const { statusCode = 200, headers, ...rest } = response;
  const body = response.body ? response.body : rest;
  return [statusCode, body, headers];
}
