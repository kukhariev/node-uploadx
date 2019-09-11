import * as http from 'http';
export class Cors {
  static allowedMethods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'];
  static maxAge = 600;
  static origin = ['*'];

  static preflight(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const origin = req.headers.origin as string;
    if (!origin) return false;
    res.setHeader('Access-Control-Allow-Origin', '*');
    const isPreflight = req.headers['access-control-request-method'] && req.method === 'OPTIONS';
    if (!isPreflight) return false;
    res.setHeader('Access-Control-Allow-Methods', Cors.allowedMethods.toString());
    const allowedHeaders = req.headers['access-control-request-headers'] as string;
    allowedHeaders && res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    res.setHeader('Access-Control-Max-Age', Cors.maxAge);
    return true;
  }
}
