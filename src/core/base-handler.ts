import * as http from 'http';
import { File } from './interfaces';

export abstract class BaseHandler {
  allowedMethods = 'GET,PUT,PATCH,POST,DELETE';
  allowedHeaders = '';
  corsMaxAge = 600;
  /**
   * Create file
   */
  abstract create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> | File;
  /**
   * Chunks
   */
  abstract write(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> | void;
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
    req.headers.origin && this.setHeader(res, 'Access-Control-Allow-Origin', req.headers.origin);
  }

  /**
   * OPTIONS preflight Request
   */
  preFlight(req: http.IncomingMessage, res: http.ServerResponse) {
    this.setHeader(res, 'Access-Control-Allow-Methods', this.allowedMethods);
    const allowedHeaders = this.allowedHeaders || req.headers['access-control-request-headers']!;
    this.setHeader(res, 'Access-Control-Allow-Headers', allowedHeaders);
    this.setHeader(res, 'Access-Control-Max-Age', this.corsMaxAge);
    res.writeHead(204);
    res.end();
  }

  private setHeader(res: http.ServerResponse, name: string, value: string | string[] | number) {
    !res.hasHeader(name) && res.setHeader(name, value);
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
