import { IncomingMessage } from 'http';

/**
 * @beta
 */
export const ERRORS = {
  BAD_REQUEST: {
    statusCode: 400,
    message: 'bad request'
  },
  INVALID_CONTENT_TYPE: {
    statusCode: 400,
    message: 'invalid or missing content-type header'
  },
  INVALID_RANGE: {
    statusCode: 400,
    message: 'invalid or missing content-range header'
  },
  INVALID_FILE_SIZE: {
    statusCode: 400,
    message: 'file size cannot be retrieved'
  },
  INVALID_FILE_NAME: {
    statusCode: 400,
    message: 'file name cannot be retrieved'
  },
  FORBIDDEN: {
    statusCode: 403,
    message: 'authenticated user is not allowed access'
  },

  FILE_NOT_ALLOWED: {
    statusCode: 403,
    message: 'file not allowed'
  },
  FILE_CONFLICT: {
    statusCode: 409,
    message: 'file conflict'
  },
  REQUEST_ENTITY_TOO_LARGE: {
    statusCode: 413,
    message: 'request entity too large'
  },
  TOO_MANY_REQUESTS: {
    statusCode: 429,
    message: 'too many requests'
  },
  FILE_NOT_FOUND: {
    statusCode: 404,
    message: 'not found'
  },
  GONE: {
    statusCode: 410,
    message: 'gone'
  },
  UNKNOWN_ERROR: {
    statusCode: 500,
    message: 'something went wrong receiving the file'
  },
  FILE_ERROR: {
    statusCode: 500,
    message: 'something went wrong writing the file'
  },
  STORAGE_ERROR: {
    statusCode: 503,
    message: 'storage error'
  }
} as const;

export interface ErrorInit {
  statusCode: number;
  message: string;
}

export class UploadxError extends Error {
  statusCode?: number;
  request: Pick<IncomingMessage, 'url' | 'headers' | 'method'> | undefined;
  detail?: string | Record<string, unknown>;
}

export function fail(error: ErrorInit, detail?: Record<string, unknown> | string): Promise<never> {
  return Promise.reject({ ...error, detail });
}
