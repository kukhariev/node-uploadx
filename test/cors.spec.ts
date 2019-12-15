import { expect } from 'chai';
import { Cors } from '../src';
import { Request, Response } from 'express';
import * as httpMocks from 'node-mocks-http';

describe('CORS', function() {
  let req: Request;
  let res: Response;
  context('Actual Request', function() {
    beforeEach(function() {
      req = httpMocks.createRequest({ url: 'http://example.com/upload', method: 'POST' });
      res = httpMocks.createResponse();
    });

    it('should enable CORS if req have `origin` header', function() {
      req.headers.origin = 'http://example.com';
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).to.be.not.undefined;
    });

    it('should not enable CORS if no `origin` header ', function() {
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).to.be.undefined;
    });
  });
  context('Preflight Request', function() {
    beforeEach(function createMocks() {
      req = httpMocks.createRequest({ url: 'http://example.com/upload', method: 'OPTIONS' });
      res = httpMocks.createResponse();
      req.headers.origin = 'http://example.com';
    });

    it('should set headers for valid preflight', function() {
      req.headers['access-control-request-method'] = 'PUT';
      req.headers['access-control-request-headers'] = 'x-header1,x-header2';
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Headers')).to.be.eq('x-header1,x-header2');
      expect(res.header('Access-Control-Allow-Methods')).to.include('PUT');
    });

    it('should not set headers for invalid preflight', function() {
      req.headers['access-control-request-headers'] = 'x-header1,x-header2';
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Headers')).to.be.undefined;
    });

    it('should set `Access-Control-Allow-Credentials` header', function() {
      Cors.credentials = true;
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Credentials')).to.be.equal('true');
    });

    it('should set custom origin', function() {
      Cors.origin = '*';
      Cors.preflight(req, res);
      expect(res.header('Access-Control-Allow-Origin')).to.be.equal('*');
    });
  });
});
