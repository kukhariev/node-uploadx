import type { IncomingMessage } from 'http';

// eslint-disable-next-line no-shadow
export const enum ERRORS {
  BAD_REQUEST = 'BAD_REQUEST',
  FILE_CONFLICT = 'FILE_CONFLICT',
  FILE_ERROR = 'FILE_ERROR',
  FILE_NOT_ALLOWED = 'FILE_NOT_ALLOWED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  GONE = 'GONE',
  INVALID_CONTENT_TYPE = 'INVALID_CONTENT_TYPE',
  INVALID_FILE_NAME = 'INVALID_FILE_NAME',
  INVALID_FILE_SIZE = 'INVALID_FILE_SIZE',
  INVALID_RANGE = 'INVALID_RANGE',
  REQUEST_ENTITY_TOO_LARGE = 'REQUEST_ENTITY_TOO_LARGE',
  STORAGE_ERROR = 'STORAGE_ERROR',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE'
}

type ErrorResponses<T = { error: string }> = {
  [K in ERRORS]: [statusCode: number, body?: T, headers?: Record<string, any>];
};

export const ERROR_RESPONSES: ErrorResponses = {
  BAD_REQUEST: [400, { error: 'bad request' }],
  INVALID_CONTENT_TYPE: [400, { error: 'invalid or missing content-type header' }],
  INVALID_RANGE: [400, { error: 'invalid or missing content-range header' }],
  INVALID_FILE_SIZE: [400, { error: 'file size cannot be retrieved' }],
  INVALID_FILE_NAME: [400, { error: 'file name cannot be retrieved' }],
  FORBIDDEN: [403, { error: 'authenticated user is not allowed access' }],
  FILE_NOT_ALLOWED: [403, { error: 'file not allowed' }],
  FILE_CONFLICT: [409, { error: 'file conflict' }],
  REQUEST_ENTITY_TOO_LARGE: [413, { error: 'request entity too large' }],
  UNSUPPORTED_MEDIA_TYPE: [415, { error: 'unsupported media type' }],
  TOO_MANY_REQUESTS: [429, { error: 'too many requests' }],
  FILE_NOT_FOUND: [404, { error: 'not found' }],
  GONE: [410, { error: 'gone' }],
  UNKNOWN_ERROR: [500, { error: 'something went wrong receiving the file' }],
  FILE_ERROR: [500, { error: 'something went wrong writing the file' }],
  STORAGE_ERROR: [503, { error: 'storage error' }]
};

export class UploadxError extends Error {
  uploadxError: ERRORS = ERRORS.UNKNOWN_ERROR;
  request?: Pick<IncomingMessage, 'url' | 'headers' | 'method'> | undefined;
  detail?: string | Record<string, unknown>;
}

export function isUploadxError(err: unknown): err is UploadxError {
  return (err as UploadxError).uploadxError !== undefined;
}

export function fail(
  uploadxError: ERRORS,
  detail?: Record<string, unknown> | string
): Promise<never> {
  return Promise.reject({ message: uploadxError, uploadxError, detail });
}
