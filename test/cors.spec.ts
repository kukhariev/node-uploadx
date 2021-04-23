import { Cors } from '../packages/core/src';
import { Request, Response } from 'express';
import * as httpMocks from 'node-mocks-http';

describe('CORS', () => {
  let cors: Cors;
  let req: Request;
  let res: Response;
  describe('Actual Request', () => {
    beforeEach(() => {
      cors = new Cors();
      req = httpMocks.createRequest({ url: 'https://example.com/upload', method: 'POST' });
      res = httpMocks.createResponse();
    });

    it('should enable CORS if req have `origin` header', () => {
      req.headers.origin = 'https://example.com';
      cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).toBeDefined();
    });

    it('should not enable CORS if no `origin` header', () => {
      cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).toBeUndefined();
    });
  });
  describe('Preflight Request', () => {
    cors = new Cors();
    beforeEach(() => {
      req = httpMocks.createRequest({ url: 'https://example.com/upload', method: 'OPTIONS' });
      res = httpMocks.createResponse();
      req.headers.origin = 'https://example.com';
    });

    it('should set headers for valid preflight', () => {
      req.headers['access-control-request-method'] = 'PUT';
      req.headers['access-control-request-headers'] = 'x-header1,x-header2';
      cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Headers')).toBe('x-header1,x-header2');
      expect(res.header('Access-Control-Allow-Methods')).toContain('PUT');
    });

    it('should allow block cors requests', () => {
      cors.allowedMethods = ['PUT', 'POST', 'HEAD'];
      cors.allowedHeaders = ['x-header3'];
      req.headers['access-control-request-method'] = 'PATCH';
      req.headers['access-control-request-headers'] = 'x-header4';
      cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Headers')).not.toContain('x-header4');
      expect(res.header('Access-Control-Allow-Methods')).not.toContain('PATCH');
    });

    it('should not set headers for invalid preflight', () => {
      req.headers['access-control-request-headers'] = 'x-header1,x-header2';
      cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Headers')).toBeUndefined();
    });

    it('should set `Access-Control-Allow-Credentials` header', () => {
      cors.credentials = true;
      cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should set custom origin', () => {
      cors.origin = '*';
      cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
