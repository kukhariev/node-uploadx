import * as http from 'http';

export abstract class BaseHandler {
  /**
   * Create file
   */
  abstract create(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> | void;
  /**
   * Chunks
   */
  abstract write(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> | void;
  /**
   * Delete by id
   */
  abstract delete(req: http.IncomingMessage, res: http.ServerResponse): any;
  /**
   * Make formated httpError response
   */
  abstract sendError(req: http.IncomingMessage, res: http.ServerResponse, error: any): any;

  /**
   * Make response
   */
  send(
    res: http.ServerResponse,
    statusCode: number,
    headers = {},
    raw?: { [key: string]: any } | string
  ) {
    const json = typeof raw === 'object';
    const body: string = json ? JSON.stringify(raw) : (raw as string) || '';

    const header = {
      'Content-Length': Buffer.byteLength(body),
      'Content-Type': json ? 'application/json' : 'text/plain'
    };

    res.writeHead(statusCode, { ...headers, ...header });
    res.end(body);
  }
}
