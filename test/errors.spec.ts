import {
  ERRORS,
  ErrorMap,
  UploadxError,
  fail,
  isUploadxError
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
});
