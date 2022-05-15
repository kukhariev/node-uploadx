import * as http from 'http';

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

export function getHeader(req: http.IncomingMessage, name: string): string {
  const raw = req.headers?.[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw || '';
}

export function appendHeader(
  res: http.ServerResponse,
  name: string,
  value: http.OutgoingHttpHeader
): void {
  const s = [res.getHeader(name), value].flat().filter(Boolean).toString();
  res.setHeader(name, s);
}

export function setHeaders(res: http.ServerResponse, headers: Headers = {}): void {
  const keys = Object.keys(headers);
  keys.length && appendHeader(res, 'Access-Control-Expose-Headers', keys);
  for (const key of keys) {
    ['location', 'link'].includes(key.toLowerCase())
      ? res.setHeader(key, encodeURI(headers[key].toString()))
      : res.setHeader(key, headers[key]);
  }
}

export function getBaseUrl(req: http.IncomingMessage): string {
  let { proto, host } = extractForwarded(req);
  host ||= extractHost(req);
  proto ||= extractProto(req);
  if (!host) return '';
  return proto ? `${proto}://${host}` : `//${host}`;
}

function extractProto(req: http.IncomingMessage): string {
  return getHeader(req, 'x-forwarded-proto');
}

function extractHost(req: http.IncomingMessage): string {
  return getHeader(req, 'host') || getHeader(req, 'x-forwarded-host');
}

function extractForwarded(req: http.IncomingMessage): { proto: string; host: string } {
  // Forwarded: by=<identifier>;for=<identifier>;host=<host>;proto=<http|https>
  let proto = '';
  let host = '';
  const header = getHeader(req, 'forwarded');
  if (header) {
    const kvPairs = header.split(';');
    for (const kv of kvPairs) {
      const [token, value] = kv.split('=');
      if (token === 'proto') proto = value;
      if (token === 'host') host = value;
    }
  }

  return { proto, host };
}

export function responseToTuple<T>(response: UploadxResponse<T> | ResponseTuple<T>): ResponseTuple {
  if (Array.isArray(response)) return response;
  const { statusCode = 200, headers, ...rest } = response;
  const body = response.body ? response.body : rest;
  return [statusCode, body, headers || {}];
}

export function tupleToResponse<T>(
  response: ResponseTuple<T> | UploadxResponse<T>
): UploadxResponse {
  if (!Array.isArray(response)) return response;
  const [statusCode, body, headers] = response;
  return { statusCode, body, headers };
}
