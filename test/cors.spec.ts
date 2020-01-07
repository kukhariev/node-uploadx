import { Cors } from '../src';
import { Request, Response } from 'express';
import * as httpMocks from 'node-mocks-http';

describe('CORS', () => {
  let req: Request;
  let res: Response;
  describe('Actual Request', () => {
    beforeEach(() => {
      req = httpMocks.createRequest({ url: 'http://example.com/upload', method: 'POST' });
      res = httpMocks.createResponse();
    });

    it('should enable CORS if req have `origin` header', () => {
      req.headers.origin = 'http://example.com';
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).toBeDefined();
    });

    it('should not enable CORS if no `origin` header ', () => {
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).toBeUndefined();
    });
  });
  describe('Preflight Request', () => {
    beforeEach(() => {
      req = httpMocks.createRequest({ url: 'http://example.com/upload', method: 'OPTIONS' });
      res = httpMocks.createResponse();
      req.headers.origin = 'http://example.com';
    });

    it('should set headers for valid preflight', () => {
      req.headers['access-control-request-method'] = 'PUT';
      req.headers['access-control-request-headers'] = 'x-header1,x-header2';
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Headers')).toBe('x-header1,x-header2');
      expect(res.header('Access-Control-Allow-Methods')).toContain('PUT');
    });

    it('should not set headers for invalid preflight', () => {
      req.headers['access-control-request-headers'] = 'x-header1,x-header2';
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Headers')).toBeUndefined();
    });

    it('should set `Access-Control-Allow-Credentials` header', () => {
      Cors.credentials = true;
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should set custom origin', () => {
      Cors.origin = '*';
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
