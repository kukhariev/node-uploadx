import http from 'http';
import { getLastOne, isRecord } from './primitives';
import { Headers, IncomingMessageWithBody, ResponseTuple, UploadxResponse } from '../types/http';
import { UploadxFile } from '../storages';

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
  limit = Infinity
): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding(encoding);
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) return reject('Content length mismatch');
    });
    req.once('end', () => resolve(body));
  });
}

/**
 * Reads the body of the incoming metadata request and parses it as JSON.
 * @param req - incoming metadata request
 * @param limit - optional limit on the size of the body
 */
export async function getJsonBody<T = Record<string, any>>(
  req: IncomingMessageWithBody<Record<any, any>>,
  limit = 16777216
): Promise<T> {
  if (typeis(req, ['json'])) {
    if (req.body) return { ...req.body } as T;
    const contentLength = typeis.hasBody(req);
    if (contentLength) {
      if (contentLength > limit) return Promise.reject('Content length limit exceeded');
      const raw = await readBody(req, 'utf8', contentLength);
      return { ...JSON.parse(raw) } as T;
    }
  }
  return {} as T;
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
function extractHost(req: http.IncomingMessage & { host?: string }): string {
  return req.host || getHeader(req, 'host');
}

/**
 * Extracts protocol from a http or https request.
 */
function extractProto(req: http.IncomingMessage & { protocol?: string }): string {
  return req.protocol || getHeader(req, 'x-forwarded-proto').toLowerCase();
}

export function responseToTuple(response: UploadxResponse | ResponseTuple): ResponseTuple {
  if (Array.isArray(response)) return response;
  const { statusCode = 200, headers, ...rest } = response;
  const body = response.body ? response.body : rest;
  return [statusCode, body, headers || {}];
}

export function tupleToResponse(response: ResponseTuple | UploadxResponse): UploadxResponse {
  if (!Array.isArray(response)) return response;
  const [statusCode, body, headers] = response;
  return { statusCode, body, headers };
}

export function normalizeHookResponse<T>(fn: (file: T) => unknown) {
  return async (file: T) => {
    const response = await fn(file);
    if (isRecord(response)) {
      const { statusCode, headers, body, ...rest } = response;
      return {
        statusCode: typeof statusCode === 'number' ? statusCode : 200,
        headers: (isRecord(headers) ? headers : {}) as Headers,
        body: body ?? rest
      };
    }
    return { body: response ?? '' };
  };
}

/**
 * Extracts UploadxFile from request after upload completes when next handler is provided.
 * @example
 * ```ts
 * app.use('/files', uploadx.upload({ directory: '/tmp' }), (req, res) => {
 *   const file = getUploadxFile(req);
 *   return res.json(file);
 * });
 * // with type narrowing
 * const s3File = getUploadxFile<S3File>(req);
 * ```
 */
export function getUploadxFile<T extends UploadxFile = UploadxFile>(
  req: IncomingMessageWithBody
): T | undefined {
  if (!req._body) return undefined;
  return req.body as T;
}
