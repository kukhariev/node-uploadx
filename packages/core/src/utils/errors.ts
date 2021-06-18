// noinspection JSUnusedGlobalSymbols

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
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  REQUEST_ENTITY_TOO_LARGE = 'REQUEST_ENTITY_TOO_LARGE',
  STORAGE_ERROR = 'STORAGE_ERROR',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE'
}

export type ResponseTuple<T = string | Record<string, any>> = [
  statusCode: number,
  body?: T,
  headers?: Record<string, any>
];
type DefaultErrorResponses = {
  [K in ERRORS]: ResponseTuple;
};

export type ErrorResponses<T = string | Record<string, any>> = {
  [code: string]: ResponseTuple<T>;
} & DefaultErrorResponses;

export const ERROR_RESPONSES: DefaultErrorResponses = {
  BAD_REQUEST: [400, { error: 'bad request' }],
  FILE_CONFLICT: [409, { error: 'file conflict' }],
  FILE_ERROR: [500, { error: 'something went wrong writing the file' }],
  FILE_NOT_ALLOWED: [403, { error: 'file not allowed' }],
  FILE_NOT_FOUND: [404, { error: 'not found' }],
  FORBIDDEN: [403, { error: 'authenticated user is not allowed access' }],
  GONE: [410, { error: 'gone' }],
  INVALID_CONTENT_TYPE: [400, { error: 'invalid or missing content-type header' }],
  INVALID_FILE_NAME: [400, { error: 'invalid file name or it cannot be retrieved' }],
  INVALID_FILE_SIZE: [400, { error: 'file size cannot be retrieved' }],
  INVALID_RANGE: [400, { error: 'invalid or missing content-range header' }],
  METHOD_NOT_ALLOWED: [405, { error: 'method not allowed' }],
  REQUEST_ENTITY_TOO_LARGE: [413, { error: 'request entity too large' }],
  STORAGE_ERROR: [503, { error: 'storage error' }],
  TOO_MANY_REQUESTS: [429, { error: 'too many requests' }],
  UNKNOWN_ERROR: [500, { error: 'something went wrong receiving the file' }],
  UNPROCESSABLE_ENTITY: [422, { error: 'validation failed' }],
  UNSUPPORTED_MEDIA_TYPE: [415, { error: 'unsupported media type' }]
};

export class UploadxError extends Error {
  uploadxError: ERRORS = ERRORS.UNKNOWN_ERROR;
  request?: Pick<IncomingMessage, 'url' | 'headers' | 'method'> | undefined;
  detail?: string | Record<string, any>;
}

export function isUploadxError(err: unknown): err is UploadxError {
  return (err as UploadxError).uploadxError !== undefined;
}

export function fail(uploadxError: string, detail?: Record<string, any> | string): Promise<never> {
  return Promise.reject({ message: uploadxError, uploadxError, detail });
}

export interface HttpError {
  statusCode: number;
  message: string;
  code: string;
  name: string;
  retryable?: boolean;
}
