import * as http from 'http';
export class Cors {
  static allowedMethods = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
  static maxAge = 600;
  static origin = ['*'];

  static preflight(req: http.IncomingMessage, res: http.ServerResponse) {
    const origin = req.headers.origin as string;
    if (!origin) return false;
    res.setHeader('Access-Control-Allow-Origin', '*');
    const isPreflight = req.headers['access-control-request-method'] && req.method === 'OPTIONS';
    if (!isPreflight) return false;
    res.setHeader('Access-Control-Allow-Methods', Cors.allowedMethods);
    const allowedHeaders = req.headers['access-control-request-headers'] as string;
    allowedHeaders && res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    res.setHeader('Access-Control-Max-Age', Cors.maxAge);
    res.setHeader('Content-Length', 0);
    res.writeHead(204);
    res.end();
    return true;
  }
}
