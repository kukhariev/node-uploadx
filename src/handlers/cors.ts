import * as http from 'http';
import { getHeader } from '../util/http';

export class Cors {
  static allowedMethods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'];
  static allowedHeaders: string | string[] = [];
  static maxAge = 600;
  static origin = '';
  static credentials = false;

  static preflight(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = getHeader(req, 'origin');
    if (!origin || res.getHeader('Access-Control-Allow-Origin')) return;
    res.setHeader('Access-Control-Allow-Origin', Cors.origin || origin);
    Cors.credentials && res.setHeader('Access-Control-Allow-Credentials', 'true');
    const isPreflight = getHeader(req, 'access-control-request-method') && req.method === 'OPTIONS';
    if (!isPreflight) return;
    res.setHeader('Access-Control-Allow-Methods', Cors.allowedMethods.toString());
    const allowedHeaders =
      Cors.allowedHeaders.toString() || getHeader(req, 'access-control-request-headers');
    allowedHeaders && res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    res.setHeader('Access-Control-Max-Age', Cors.maxAge);
    return;
  }
}
