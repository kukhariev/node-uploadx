import {
  ErrorMap,
  ERRORS,
  fail,
  isUploadxError,
  normalizeErrorResponse,
  UploadxError
} from '../packages/core/src/utils/errors';

describe('errors', () => {
  describe('ErrorMap', () => {
    it('should contain all error codes', () => {
      expect(Object.keys(ErrorMap)).toHaveLength(Object.keys(ERRORS).length);
    });

    it('should have correct error shape', () => {
      const err = ErrorMap.BadRequest;
      expect(err).toEqual({
        code: 'BadRequest',
        message: 'Bad request',
        statusCode: 400
      });
    });
  });

  describe('UploadxError', () => {
    it('should store cause', () => {
      const cause = new Error('original');
      const err = new UploadxError(ERRORS.BAD_REQUEST, 'msg', cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe('isUploadxError', () => {
    it('should return true for UploadxError instances', () => {
      expect(isUploadxError(new UploadxError(ERRORS.BAD_REQUEST))).toBe(true);
    });

    it('should return false for non-UploadxError', () => {
      expect(isUploadxError(new Error('test'))).toBe(false);
    });

    it('should return false for null', () => {
      expect(isUploadxError(null)).toBe(false);
    });
  });

  describe('fail', () => {
    it('should reject with UploadxError', async () => {
      await expect(fail(ERRORS.BAD_REQUEST)).rejects.toBeInstanceOf(UploadxError);
    });

    it('should use human-readable message', async () => {
      await expect(fail(ERRORS.BAD_REQUEST)).rejects.toHaveProperty('message', 'Bad request');
    });

    it('should store cause', async () => {
      const cause = 'test cause';
      await expect(fail(ERRORS.BAD_REQUEST, cause)).rejects.toHaveProperty('cause', cause);
    });
  });

  describe('normalizeErrorResponse', () => {
    it('should convert tuple with body object', () => {
      const response: [number, Record<string, any>] = [415, { message: 'video only' }];
      const result = normalizeErrorResponse(response);

      expect(result.statusCode).toBe(415);
      expect(result.message).toBe('video only');
    });

    it('should convert tuple with body string and headers', () => {
      const response: [number, string, Record<string, string>] = [
        415,
        'video only',
        { 'content-type': 'text/plain' }
      ];
      const result = normalizeErrorResponse(response);

      expect(result.statusCode).toBe(415);
      expect(result.message).toBe('video only');
      expect(result.headers).toEqual({ 'content-type': 'text/plain' });
    });

    it('should default to statusCode 500 for object without statusCode', () => {
      const response = { code: 'TestError', message: 'test message' };
      const result = normalizeErrorResponse(response as any);

      expect(result.statusCode).toBe(500);
      expect(result.code).toBe('TestError');
      expect(result.message).toBe('test message');
    });
  });
});
