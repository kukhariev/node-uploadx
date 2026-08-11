import { IncomingHttpHeaders, IncomingMessage } from 'http';
import * as utils from '../packages/core/src';

type TestRequest = IncomingMessage & { host?: string };

function buildReq(headers: IncomingHttpHeaders = {}, host?: string): TestRequest {
  const req = { headers } as TestRequest;
  if (host !== undefined) req.host = host;
  return req;
}

describe('http utils', () => {
  const mime = 'application/vnd+json';
  const req = buildReq({ 'content-type': mime });

  describe('typeis', () => {
    it('detects request content type', () => {
      expect(utils.typeis(buildReq(), ['json'])).toBe(false);
      expect(utils.typeis(req, ['html'])).toBe(false);
      expect(utils.typeis(req, ['json'])).toBe(mime);
    });

    it('matches mime patterns', () => {
      expect(utils.typeis.is(mime, ['application/vnd+json'])).toBe(mime);
      expect(utils.typeis.is(mime, ['vnd+json'])).toBe(mime);
      expect(utils.typeis.is(mime, ['application/*'])).toBe(mime);
      expect(utils.typeis.is(mime, ['json', 'xml'])).toBe(mime);
      expect(utils.typeis.is(mime, ['*/*'])).toBe(mime);
    });

    it('detects body from content length', () => {
      expect(utils.typeis.hasBody(buildReq())).toBe(false);
      expect(utils.typeis.hasBody(buildReq({ 'content-length': '0' }))).toBe(0);
      expect(utils.typeis.hasBody(buildReq({ 'content-length': '1' }))).toBe(1);
    });
  });

  describe('getHeader', () => {
    it('not exist', () => {
      expect(utils.getHeader(req, 'not exist')).toBe('');
    });

    it('single', () => {
      const r = buildReq({ head: 'value' });
      expect(utils.getHeader(r, 'head')).toBe('value');
    });

    it('array', () => {
      const r = buildReq({ head: ['value1', 'value2 '] });
      expect(utils.getHeader(r, 'head')).toBe('value2');
    });

    it('multiple', () => {
      const r = buildReq({ head: 'value1 ,value2' });
      expect(utils.getHeader(r, 'head')).toBe('value2');
    });

    it('multiple, all', () => {
      const r = buildReq({ head: 'value1,value2 ' });
      expect(utils.getHeader(r, 'head', true)).toBe('value1,value2');
    });
  });

  describe('getBaseUrl', () => {
    it('no-host', () => {
      expect(utils.getBaseUrl(req)).toBe('');
    });

    it('no-proto', () => {
      const r = buildReq({ host: 'example' });
      expect(utils.getBaseUrl(r)).toBe('//example');
    });

    it('absolute', () => {
      const r = buildReq({ host: 'example:4443', 'x-forwarded-proto': 'https' });
      expect(utils.getBaseUrl(r)).toBe('https://example:4443');
    });

    it('express4 host without port', () => {
      const r = buildReq({ host: 'example:4443', 'x-forwarded-proto': 'https' }, 'example');
      expect(utils.getBaseUrl(r)).toBe('https://example:4443');
    });

    it('forwarded host without port', () => {
      const r = buildReq({ host: 'internal:3002', 'x-forwarded-proto': 'https' }, 'public.example');
      expect(utils.getBaseUrl(r)).toBe('https://public.example');
    });

    it('fallback to req.host when header is missing', () => {
      const r = buildReq({}, 'example:4443');
      expect(utils.getBaseUrl(r)).toBe('//example:4443');
    });
  });
});
