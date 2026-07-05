import { IncomingMessage } from 'http';
import * as utils from '../packages/core/src';

describe('http utils', () => {
  const mime = 'application/vnd+json';
  const req = { headers: { 'content-type': mime } } as IncomingMessage;

  it('typeis()', () => {
    expect(utils.typeis({ headers: {} } as IncomingMessage, ['json'])).toBe(false);
    expect(utils.typeis(req, ['html'])).toBe(false);
    expect(utils.typeis(req, ['json'])).toBe(mime);
  });

  it('typeis.is()', () => {
    expect(utils.typeis.is(mime, ['application/vnd+json'])).toBe(mime);
    expect(utils.typeis.is(mime, ['vnd+json'])).toBe(mime);
    expect(utils.typeis.is(mime, ['application/*'])).toBe(mime);
    expect(utils.typeis.is(mime, ['json', 'xml'])).toBe(mime);
    expect(utils.typeis.is(mime, ['*/*'])).toBe(mime);
  });

  it('typeis.hasBody()', () => {
    expect(utils.typeis.hasBody({ headers: {} } as IncomingMessage)).toBe(false);
    expect(utils.typeis.hasBody({ headers: { 'content-length': '0' } } as IncomingMessage)).toBe(0);
    expect(utils.typeis.hasBody({ headers: { 'content-length': '1' } } as IncomingMessage)).toBe(1);
  });

  it('getHeader(not exist)', () => {
    expect(utils.getHeader(req, 'not exist')).toBe('');
  });

  it('getHeader(single)', () => {
    req.headers = { head: 'value' };
    expect(utils.getHeader(req, 'head')).toBe('value');
  });

  it('getHeader(array)', () => {
    req.headers = { head: ['value1', 'value2 '] };
    expect(utils.getHeader(req, 'head')).toBe('value2');
  });

  it('getHeader(multiple)', () => {
    req.headers = { head: 'value1 ,value2' };
    expect(utils.getHeader(req, 'head')).toBe('value2');
  });

  it('getHeader(multiple, all)', () => {
    req.headers = { head: 'value1,value2 ' };
    expect(utils.getHeader(req, 'head', true)).toBe('value1,value2');
  });

  it('getBaseUrl(no-host)', () => {
    expect(utils.getBaseUrl(req)).toBe('');
  });

  it('getBaseUrl(no-proto)', () => {
    req.headers = { host: 'example' };
    expect(utils.getBaseUrl(req)).toBe('//example');
  });

  it('getBaseUrl(absolute)', () => {
    req.headers = { host: 'example:4443', 'x-forwarded-proto': 'https' };
    expect(utils.getBaseUrl(req)).toBe('https://example:4443');
  });
});
