// noinspection JSUnusedGlobalSymbols

import type { IncomingMessage } from 'http';
import { ResponseTuple, UploadxResponse } from './http';

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
  UNSUPPORTED_MEDIA_TYPE = 'UnsupportedMediaType'
}

export type ErrorResponses<T extends string = string> = {
  [K in T]: ResponseTuple<Partial<HttpErrorBody>>;
};

class E_ {
  @E_._buildErrorBody
  static errors = {
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
    StorageError: [503, 'Storage error'],
    TooManyRequests: [429, 'Too many requests'],
    UnknownError: [500, 'Something went wrong receiving the file'],
    UnprocessableEntity: [422, 'Validation failed'],
    UnsupportedMediaType: [415, 'Unsupported media type']
  } as ErrorResponses<ERRORS>;

  static _buildErrorBody = (target: typeof E_, _: string): void => {
    (Object.keys(target.errors) as ERRORS[]).forEach(code => {
      const message = target.errors[code][1] as string;
      target.errors[code][1] = { code, message };
    });
  };
}
export const ErrorMap = E_.errors;

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

interface HttpErrorBody {
  message: string;
  code: string;
  name?: string;
  retryable?: boolean;
  detail?: Record<string, any> | string;
}

export type HttpError<T = HttpErrorBody> = UploadxResponse<T> & { statusCode: number };
