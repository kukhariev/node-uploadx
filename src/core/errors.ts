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
  CHUNK_TOO_BIG: {
    statusCode: 413,
    message: 'Chunk too big'
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

type UploadXErrorType = typeof ERRORS[keyof typeof ERRORS];

export class UploadXError extends Error {
  code: string;
  statusCode: number;
  message: string;
  constructor(error: UploadXErrorType, public details?: any) {
    super(error.message);
    this.code = Object.keys(ERRORS)
      .find(k => ERRORS[k] === error)!
      .toLowerCase();
    this.statusCode = error.statusCode;
    this.message = error.message;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.stackTraceLimit = 3;
  }
}
