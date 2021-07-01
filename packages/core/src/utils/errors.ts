// noinspection JSUnusedGlobalSymbols

import type { IncomingMessage } from 'http';

// eslint-disable-next-line no-shadow
export const enum ERRORS {
  BAD_REQUEST = 'BadRequest',
  FILE_CONFLICT = 'FileConflict',
  FILE_ERROR = 'FileError',
  FILE_NOT_ALLOWED = 'FileNotAllowed',
  FILE_NOT_FOUND = 'FileNotFound',
  FORBIDDEN = 'Forbidden',
  GONE = 'Gone',
  INVALID_CONTENT_TYPE = 'InvalidContentType',
  INVALID_FILE_NAME = 'InvalidFileName',
  INVALID_FILE_SIZE = 'InvalidFileSize',
  INVALID_RANGE = 'InvalidRange',
  METHOD_NOT_ALLOWED = 'MethodNotAllowed',
  REQUEST_ENTITY_TOO_LARGE = 'RequestEntityTooLarge',
  STORAGE_ERROR = 'StorageError',
  TOO_MANY_REQUESTS = 'TooManyRequests',
  UNKNOWN_ERROR = 'UnknownError',
  UNPROCESSABLE_ENTITY = 'UnprocessableEntity',
  UNSUPPORTED_MEDIA_TYPE = 'UnsupportedMediaType'
}

export type ResponseTuple<T = string | Record<string, any>> = [
  statusCode: number,
  body?: T,
  headers?: Record<string, any>
];
export type ErrorResponses<T extends string = string> = {
  [K in T]: ResponseTuple<Partial<HttpErrorBody>>;
};

export const ERROR_RESPONSES: ErrorResponses<ERRORS> = {
  BadRequest: [400, { message: 'Bad request' }],
  FileConflict: [409, { message: 'File conflict' }],
  FileError: [500, { message: 'Something went wrong writing the file' }],
  FileNotAllowed: [403, { message: 'File not allowed' }],
  FileNotFound: [404, { message: 'Not found' }],
  Forbidden: [403, { message: 'Authenticated user is not allowed access' }],
  Gone: [410, { message: 'Gone' }],
  InvalidContentType: [400, { message: 'Invalid or missing "content-type" header' }],
  InvalidFileName: [400, { message: 'Invalid file name or it cannot be retrieved' }],
  InvalidFileSize: [400, { message: 'File size cannot be retrieved' }],
  InvalidRange: [400, { message: 'Invalid or missing content-range header' }],
  MethodNotAllowed: [405, { message: 'Method not allowed' }],
  RequestEntityTooLarge: [413, { message: 'Request entity too large' }],
  StorageError: [503, { message: 'Storage error' }],
  TooManyRequests: [429, { message: 'Too many requests' }],
  UnknownError: [500, { message: 'Something went wrong receiving the file' }],
  UnprocessableEntity: [422, { message: 'Validation failed' }],
  UnsupportedMediaType: [415, { message: 'Unsupported media type' }]
};

export class ErrorMap {
  static get errorMap(): ErrorResponses<ERRORS> {
    const errMap = {} as ErrorResponses;
    (Object.keys(ErrorMap._errorMap) as ERRORS[]).forEach(code => {
      (ErrorMap._errorMap[code][1] ||= {}).code = code;
      errMap[code] = ErrorMap._errorMap[code];
    });
    return errMap;
  }

  private static _errorMap = ERROR_RESPONSES;
}

export class UploadxError extends Error {
  uploadxErrorCode: ERRORS = ERRORS.UNKNOWN_ERROR;
  request?: Pick<IncomingMessage, 'url' | 'headers' | 'method'> | undefined;
  detail?: string | Record<string, any>;
}

export function isUploadxError(err: unknown): err is UploadxError {
  return !!(err as UploadxError).uploadxErrorCode;
}

export function fail(
  uploadxErrorCode: string,
  detail?: Record<string, any> | string
): Promise<never> {
  return Promise.reject({ message: uploadxErrorCode, uploadxErrorCode, detail });
}

export function httpErrorToTuple(error: HttpError): ResponseTuple<HttpErrorBody> {
  const { statusCode, headers, ...body } = error;
  return [statusCode, body, headers];
}

interface HttpErrorBody {
  message: string;
  code: string;
  name?: string;
  retryable?: boolean;
  detail?: Record<string, any> | string;
}

export interface HttpError extends HttpErrorBody {
  statusCode: number;
  headers?: Record<string, any>;
}
