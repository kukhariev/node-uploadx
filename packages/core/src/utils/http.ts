import * as http from 'http';
import { getLastOne } from './primitives';

export interface IncomingMessageWithBody<T = any> extends http.IncomingMessage {
  body?: T;
  _body?: boolean;
}

export type Headers = Record<string, number | string | string[]>;

export type ResponseBody = string | Record<string, any>;
export type ResponseBodyType = 'text' | 'json';
export type ResponseTuple<T = ResponseBody> = [statusCode: number, body?: T, headers?: Headers];

export interface UploadxResponse<T = ResponseBody> extends Record<string, any> {
  statusCode?: number;
  headers?: Headers;
  body?: T;
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

/**
 * Reads the body from the request.
 * @param req - request object
 * @param encoding - encoding to use
 * @param limit - optional limit on the size of the body
 */
export function readBody(
  req: http.IncomingMessage,
  encoding = 'utf8' as BufferEncoding,
  limit?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding(encoding);
    req.on('data', chunk => {
      if (limit && body.length > limit) return reject('body length limit');
      body += chunk;
    });
    req.once('end', () => resolve(body));
  });
}

/**
 * Reads the body of the incoming metadata request and parses it as JSON.
 * @param req - incoming metadata request
 * @param limit - optional limit on the size of the body
 */
export async function getMetadata(
  req: IncomingMessageWithBody<Record<any, any>>,
  limit = 16777216
): Promise<Record<any, any>> {
  if (!typeis(req, ['json'])) return {};
  if (req.body) return { ...req.body };
  if (typeis.hasBody(req) > limit) return Promise.reject('body length limit');
  const raw = await readBody(req, 'utf8', limit);
  return { ...JSON.parse(raw) } as Record<any, any>;
}

/**
 * Retrieve the value of a specific header of an HTTP request.
 * @param req - request object
 * @param name - name of the header
 * @param all - if true, returns  all values of the header, comma-separated, otherwise returns the last value.
 */
export function getHeader(req: http.IncomingMessage, name: string, all = false): string {
  const raw = req.headers?.[name.toLowerCase()];
  if (!raw || raw.length === 0) return '';
  return all ? raw.toString().trim() : getLastOne(Array.isArray(raw) ? raw : raw.split(',')).trim();
}

/**
 * Appends value to the end of the multi-value header
 */
export function appendHeader(
  res: http.ServerResponse,
  name: string,
  value: http.OutgoingHttpHeader
): void {
  const s = [res.getHeader(name), value].flat().filter(Boolean).toString();
  res.setHeader(name, s);
}

/**
 * Sets the value of a specific header of an HTTP response.
 */
export function setHeaders(res: http.ServerResponse, headers: Headers = {}): void {
  const keys = Object.keys(headers);
  keys.length && appendHeader(res, 'Access-Control-Expose-Headers', keys);
  for (const key of keys) {
    ['location', 'link'].includes(key.toLowerCase())
      ? res.setHeader(key, encodeURI(headers[key].toString()))
      : res.setHeader(key, headers[key]);
  }
}

/**
 * Try build a protocol:hostname:port string from a request object.
 */
export function getBaseUrl(req: http.IncomingMessage): string {
  const host = extractHost(req);
  if (!host) return '';
  const proto = extractProto(req);
  if (!proto) return `//${host}`;
  return `${proto}://${host}`;
}

/**
 * Extracts host with port from a http or https request.
 */
export function extractHost(
  req: http.IncomingMessage & { host?: string; hostname?: string }
): string {
  return getHeader(req, 'host');
  // return req.host || req.hostname || getHeader(req, 'host'); // for express v5 / fastify
}

/**
 * Extracts protocol from a http or https request.
 */
export function extractProto(req: http.IncomingMessage): string {
  return getHeader(req, 'x-forwarded-proto').toLowerCase();
}

export function responseToTuple<T extends ResponseBody>(
  response: UploadxResponse<T> | ResponseTuple<T>
): ResponseTuple {
  if (Array.isArray(response)) return response;
  const { statusCode = 200, headers, ...rest } = response;
  const body = response.body ? response.body : rest;
  return [statusCode, body, headers || {}];
}

export function tupleToResponse<T extends ResponseBody>(
  response: ResponseTuple<T> | UploadxResponse<T>
): UploadxResponse {
  if (!Array.isArray(response)) return response;
  const [statusCode, body, headers] = response;
  return { statusCode, body, headers };
}
