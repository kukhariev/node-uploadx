/**
 * @beta
 */
export const ERRORS = {
  BAD_REQUEST: {
    statusCode: 400,
    message: 'Bad request'
  },
  INVALID_CONTENT_TYPE: {
    statusCode: 400,
    message: 'Invalid or missing Content-Type header'
  },
  INVALID_RANGE: {
    statusCode: 400,
    message: 'Invalid or missing Content-Range header'
  },
  INVALID_FILE_SIZE: {
    statusCode: 400,
    message: 'File size cannot be retrieved'
  },
  INVALID_FILE_NAME: {
    statusCode: 400,
    message: 'File name cannot be retrieved'
  },
  FILE_TOO_LARGE: {
    statusCode: 403,
    message: 'File is too large'
  },
  FILE_TYPE_NOT_ALLOWED: {
    statusCode: 403,
    message: 'File type not allowed'
  },
  FILE_CONFLICT: {
    statusCode: 409,
    message: 'File conflict'
  },
  CHUNK_TOO_BIG: {
    statusCode: 413,
    message: 'Chunk too big'
  },
  TOO_MANY_REQUESTS: {
    statusCode: 429,
    message: 'Too Many Requests'
  },
  FILE_NOT_FOUND: {
    statusCode: 404,
    message: 'File not found'
  },
  FILE_GONE: {
    statusCode: 410,
    message: 'File gone'
  },
  UNKNOWN_ERROR: {
    statusCode: 500,
    message: 'Something went wrong receiving the file'
  },
  FILE_ERROR: {
    statusCode: 500,
    message: 'Something went wrong writing the file'
  }
};

export interface ErrorStatus {
  statusCode: number;
  message: string;
  code?: any;
  details?: any;
}

export function fail<T>(error: ErrorStatus, details?: any) {
  return Promise.reject<T>({ ...error, details });
}
