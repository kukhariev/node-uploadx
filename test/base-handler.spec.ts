import { createRequest, createResponse } from 'node-mocks-http';
import { testStorage, TestUploader } from './shared';
import * as http from 'http';

describe('BaseHandler', () => {
  let uploader: TestUploader;
  TestUploader.methods = ['post', 'put', 'options', 'get'];

  beforeEach(() => (uploader = new TestUploader({ storage: testStorage })));

  it('should implement options()', async () => {
    const res = createResponse();
    const req = createRequest({ url: '/files' });
    await uploader.options(req, res);
    expect(res.statusCode).toBe(204);
  });

  it('should check if storage not ready', () => {
    uploader.storage.isReady = false;
    const res = createResponse();
    uploader.handle(createRequest({ method: 'OPTIONS' }), res);
    expect(res.statusCode).toBe(503);
  });

  it('should check http method', () => {
    const res = createResponse();
    uploader.handle(createRequest({ method: 'PATCH' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('should check user (no auth)', async () => {
    const res = createResponse();
    const req = createRequest({ url: '/files' });
    await expect(uploader.get(req, res)).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
  });

  it('should check user (default)', async () => {
    const res = createResponse();
    const req = createRequest({ url: '/files' });
    req.user = { _id: '12345' };
    await expect(uploader.get(req, res)).resolves.toHaveProperty('items', []);
  });

  it('should check user (custom)', async () => {
    uploader = new TestUploader({
      storage: testStorage,
      userIdentifier: (_, res) => res.locals.user_id // eslint-disable-line
    });
    const res = createResponse({ locals: { user_id: '12345' } });
    const req = createRequest({ url: '/files' });
    await expect(uploader.get(req, res)).resolves.toHaveProperty('items', []);
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
  ])('nodejs: getId(%p) === %p', (url, id) => {
    expect(uploader.getId({ url } as http.IncomingMessage)).toBe(id);
  });
});
