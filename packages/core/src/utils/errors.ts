// noinspection JSUnusedGlobalSymbols

import { UploadxResponse } from './http';

// eslint-disable-next-line no-shadow
export enum ERRORS {
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
  UNSUPPORTED_MEDIA_TYPE = 'UnsupportedMediaType',
  CHECKSUM_MISMATCH = 'ChecksumMismatch'
}

export type ErrorResponses<T extends string = string> = {
  [K in T]: HttpError;
};

class E_ {
  static errors: ErrorResponses = {};
  @E_._buildErrorBody
  private static _errors: Record<string, [number, string]> = {
    BadRequest: [400, 'Bad request'],
    FileConflict: [409, 'File conflict'],
    FileError: [500, 'Something went wrong writing the file'],
    FileNotAllowed: [403, 'File not allowed'],
    FileNotFound: [404, 'Not found'],
    Forbidden: [403, 'Authenticated user is not allowed access'],
    Gone: [410, 'Gone'],
    InvalidContentType: [400, 'Invalid or missing "content-type" header'],
    InvalidFileName: [400, 'Invalid file name or it cannot be retrieved'],
    InvalidFileSize: [400, 'File size cannot be retrieved'],
    InvalidRange: [400, 'Invalid or missing content-range header'],
    MethodNotAllowed: [405, 'Method not allowed'],
    RequestEntityTooLarge: [413, 'Request entity too large'],
    ChecksumMismatch: [460, 'Checksum mismatch'],
    StorageError: [503, 'Storage error'],
    TooManyRequests: [429, 'Too many requests'],
    UnknownError: [500, 'Something went wrong'],
    UnprocessableEntity: [422, 'Validation failed'],
    UnsupportedMediaType: [415, 'Unsupported media type']
  };

  static _buildErrorBody = (target: typeof E_, _: string): void => {
    (Object.keys(target._errors) as ERRORS[]).forEach(code => {
      const [statusCode, message] = target._errors[code];
      target.errors[code] = { code, message, statusCode };
    });
  };
}

export const ErrorMap = E_.errors;

export class UploadxError extends Error {
  uploadxErrorCode: ERRORS = ERRORS.UNKNOWN_ERROR;
  detail?: unknown;
}

export function isUploadxError(err: unknown): err is UploadxError {
  return !!(err as UploadxError).uploadxErrorCode;
}

export function fail(uploadxErrorCode: string, detail: unknown = ''): Promise<never> {
  return Promise.reject({
    name: 'UploadxError',
    message: uploadxErrorCode,
    uploadxErrorCode,
    detail
  });
}

export interface HttpErrorBody {
  message: string;
  code: string;
  uploadxErrorCode?: string;
  name?: string;
  retryable?: boolean;
  detail?: Record<string, any> | string;
}

export interface HttpError<T = HttpErrorBody> extends UploadxResponse<T> {
  statusCode: number;
}
