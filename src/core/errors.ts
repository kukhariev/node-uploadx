export const ERRORS = {
  INVALID_CONTENT_TYPE: {
    code: 'INVALID_CONTENT_TYPE'.toLowerCase(),
    statusCode: 400,
    message: 'Invalid Content-Type header'
  },
  INVALID_FILE_TYPE: {
    code: 'INVALID_FILE_TYPE'.toLowerCase(),
    statusCode: 403,
    message: 'File type not acceptable'
  },
  INVALID_FILE_SIZE: {
    code: 'INVALID_FILE_SIZE'.toLowerCase(),
    statusCode: 400,
    message: 'File size was not a valid number'
  },
  INVALID_FILE_NAME: {
    code: 'INVALID_FILE_NAME'.toLowerCase(),
    statusCode: 400,
    message: 'File name invalid'
  },
  FILE_TOO_BIG: {
    code: 'FILE_SIZE_TOO_BIG'.toLowerCase(),
    statusCode: 403,
    message: 'File too big'
  },
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND'.toLowerCase(),
    statusCode: 404,
    message: 'The file for this URI was not found'
  },
  MISSING_RANGE: {
    code: 'MISSING_RANGE'.toLowerCase(),
    statusCode: 400,
    message: 'Content-Range header was not provided'
  },
  INVALID_RANGE: {
    code: 'INVALID_RANGE'.toLowerCase(),
    statusCode: 400,
    message: 'Invalid Content-Range header '
  },
  REQUEST_SIZE_MISMATCH: {
    code: 'REQUEST_SIZE_MISMATCH'.toLowerCase(),
    statusCode: 400,
    message: 'Content-Length header does not match Content-Range header'
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR'.toLowerCase(),
    statusCode: 500,
    message: 'Something went wrong receiving the file'
  },
  FILE_WRITE_ERROR: {
    code: 'FILE_WRITE_ERROR'.toLowerCase(),
    statusCode: 500,
    message: 'Something went wrong writing the file'
  }
};

export class UploadXError extends Error {
  code: string;
  statusCode: number;
  message: string;
  constructor(error: typeof ERRORS[keyof typeof ERRORS], public inner?: any) {
    super(error.message);
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.message = error.message;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
