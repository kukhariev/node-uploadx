import { createRequest, createResponse } from 'node-mocks-http';
import { testStorage, TestUploader } from './shared';
import * as http from 'http';

describe('BaseHandler', () => {
  let uploader: TestUploader;
  TestUploader.methods = ['post', 'put', 'options'];

  beforeEach(() => (uploader = new TestUploader({ storage: testStorage })));

  it('should implement get()', async () => {
    const res = createResponse();
    const req = createRequest({ url: '/files/12345' });
    await expect(uploader.get(req, res)).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
  });

  it('should check if storage not ready', () => {
    uploader.storage.isReady = false;
    const res = createResponse();
    uploader.handle(createRequest({ method: 'OPTIONS' }), res);
    expect(res.statusCode).toBe(503);
  });

  it('should check http method', () => {
    const res = createResponse();
    uploader.handle(createRequest({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  describe('sendError', () => {
    beforeEach(() => {
      uploader = new TestUploader({ storage: testStorage });
    });

    it('should send Error', () => {
      uploader.responseType = 'json';
      const res = createResponse();
      const sendSpy = jest.spyOn(uploader, 'send');
      const err = new Error('Error Message');
      uploader.sendError(res, err);
      expect(sendSpy).toHaveBeenCalledWith(res, {
        statusCode: 500,
        body: {
          error: {
            message: 'Generic Uploadx Error',
            code: 'GenericUploadxError'
          }
        },
        headers: undefined
      });
    });
  });

  it.each([
    ['/1/2', '1/2'],
    ['/3', '3'],
    ['/files', 'files'],
    ['/', '']
  ])('express: getId(%p) === %p', (url, name) => {
    expect(uploader.getId(createRequest({ url }))).toBe(name);
  });

  it.each([
    ['/files/1/2', '1/2'],
    ['/files/3', '3'],
    ['/files/files', 'files'],
    ['/', ''],
    ['/1/2', ''],
    ['/3/files/4', '']
  ])('nodejs: getId(%p) === %p', (url, name) => {
    expect(uploader.getId({ url } as http.IncomingMessage)).toBe(name);
  });
});
