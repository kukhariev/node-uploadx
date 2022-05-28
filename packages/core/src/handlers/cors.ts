import * as http from 'http';
import { getHeader } from '../utils';

export class Cors {
  allowedMethods: string[] = [];
  allowedHeaders: string | string[] = [];
  maxAge = 600;
  origin = '';
  credentials = false;

  preflight(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = getHeader(req, 'origin');
    if (!origin || res.getHeader('Access-Control-Allow-Origin')) return;
    res.setHeader('Access-Control-Allow-Origin', this.origin || origin);
    this.credentials && res.setHeader('Access-Control-Allow-Credentials', 'true');
    const accessControlRequestMethod = getHeader(req, 'access-control-request-method');
    const isPreflight = accessControlRequestMethod && req.method === 'OPTIONS';
    if (!isPreflight) return;
    res.setHeader(
      'Access-Control-Allow-Methods',
      this.allowedMethods.toString() || accessControlRequestMethod
    );
    const allowedHeaders =
      this.allowedHeaders.toString() || getHeader(req, 'access-control-request-headers', true);
    allowedHeaders && res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    res.setHeader('Access-Control-Max-Age', this.maxAge);
    return;
  }
}
