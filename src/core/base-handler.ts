import * as http from 'http';
import { File } from './interfaces';

export abstract class BaseHandler {
  /**
   * Create file
   */
  abstract create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> | File;
  /**
   * Chunks
   */
  abstract write(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> | void;
  /**
   * Delete by id
   */
  abstract delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> | File;
  /**
   * Make formated httpError response
   */
  abstract sendError(req: http.IncomingMessage, res: http.ServerResponse, error: any): void;

  /**
   * Set Origin header
   * @internal
   */
  setOrigin(req: http.IncomingMessage, res: http.ServerResponse) {
    req.headers.origin && res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }

  /**
   * OPTIONS preflight Request
   * @internal
   */
  preFlight(req: http.IncomingMessage, res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,HEAD');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers']!);
    res.writeHead(204);
    res.end();
  }

  /**
   * Make response
   */
  send(
    res: http.ServerResponse,
    statusCode: number,
    headers = {},
    body?: { [key: string]: any } | string | undefined
  ) {
    const json = typeof body === 'object';
    const data = json ? JSON.stringify(body) : (body as string) || '';
    res.setHeader('Content-Length', Buffer.byteLength(data));
    json && data && res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode, headers);
    res.end(data);
  }
}
