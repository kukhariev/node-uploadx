import * as http from 'http';
import { getHeader } from './utils';

export class Cors {
  static allowedMethods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'];
  static allowedHeaders = [];
  static maxAge = 600;
  static origin = '*';

  static preflight(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const origin = getHeader(req, 'origin');
    if (!origin) return false;
    res.setHeader('Access-Control-Allow-Origin', Cors.origin || origin);
    const isPreflight = getHeader(req, 'access-control-request-method') && req.method === 'OPTIONS';
    if (!isPreflight) return false;
    res.setHeader('Access-Control-Allow-Methods', Cors.allowedMethods.toString());
    const allowedHeaders =
      Cors.allowedHeaders.toString() || getHeader(req, 'access-control-request-headers');
    allowedHeaders && res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    res.setHeader('Access-Control-Max-Age', Cors.maxAge);
    return true;
  }
}
