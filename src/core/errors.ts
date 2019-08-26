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
  FILE_TOO_LARGE: {
    statusCode: 403,
    message: 'file is too large'
  },
  FILE_TYPE_NOT_ALLOWED: {
    statusCode: 403,
    message: 'file type not allowed'
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
  }
} as const;

export interface ErrorStatus {
  statusCode: number;
  message: string;
  code?: any;
  details?: any;
}

export function fail(error: ErrorStatus, details?: any): Promise<never> {
  return Promise.reject({ ...error, details });
}
