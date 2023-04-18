import { IncomingMessage, ServerResponse } from 'http';
import { getHeader } from '../utils';

export interface CorsConfig {
  allowedHeaders?: string[];
  allowedMethods?: string[];
  allowOrigins?: string[];
  credentials?: boolean;
  exposeHeaders?: string[];
  maxAge?: number;
}

export class Cors {
  allowedHeaders: string[];
  allowedMethods: string[];
  allowOrigins: string[];
  credentials: boolean;
  exposeHeaders: string[];
  maxAge: number;

  constructor(config: CorsConfig = {}) {
    this.allowedHeaders = config.allowedHeaders || [];
    this.allowedMethods = config.allowedMethods || [];
    this.allowOrigins = config.allowOrigins || [];
    this.credentials = config.credentials ?? false;
    this.exposeHeaders = config.exposeHeaders || [];
    this.maxAge = config.maxAge ?? 600;
  }

  /**
   * Set cors headers
   * @returns `true` if it is a preflight request
   */
  preflight(req: IncomingMessage, res: ServerResponse, next?: (e?: any) => any): boolean {
    const origin = getHeader(req, 'origin');
    if (!origin || res.getHeader('Access-Control-Allow-Origin')) return false;
    if (!this.isOriginAllowed(origin)) {
      next?.(new Error(`Access is not allowed from the origin: ${origin}`));
      return true;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    this.credentials && res.setHeader('Access-Control-Allow-Credentials', 'true');

    const vary = [res.getHeader('vary'), 'Origin'].flat().filter(Boolean);

    const accessControlRequestMethod = getHeader(req, 'access-control-request-method');
    if (accessControlRequestMethod && req.method === 'OPTIONS') {
      // preflight
      res.setHeader(
        'Access-Control-Allow-Methods',
        this.allowedMethods.join() || accessControlRequestMethod
      );

      const accessControlRequestHeaders = getHeader(req, 'access-control-request-headers', true);
      const allowedHeaders = this.allowedHeaders.join() || accessControlRequestHeaders;
      allowedHeaders && res.setHeader('Access-Control-Allow-Headers', allowedHeaders);

      !this.allowedHeaders.length && vary.push('Access-Control-Request-Headers');
      !this.allowedMethods.length && vary.push('Access-Control-Request-Method');
      res.setHeader('Vary', vary.join());

      res.setHeader('Access-Control-Max-Age', this.maxAge);
      return true;
    }

    // actual
    res.setHeader('Vary', vary.join());
    this.exposeHeaders.length &&
      res.setHeader('Access-Control-Expose-Headers', this.exposeHeaders.join());
    return false;
  }

  /**
   * Check if origin allowed
   */
  isOriginAllowed(origin: string): boolean {
    if (this.allowOrigins.length === 0) return true;
    return this.allowOrigins.some(allowedOrigin => {
      return (
        allowedOrigin === origin ||
        allowedOrigin === '*' ||
        new RegExp(allowedOrigin.replace('*', '.*')).test(origin)
      );
    });
  }
}

type RequestHandler = (req: IncomingMessage, res: ServerResponse, next?: (e?: any) => any) => void;

const defaultCorsConfig: CorsConfig = {
  allowedHeaders: [],
  allowedMethods: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH'],
  allowOrigins: [],
  credentials: false,
  exposeHeaders: [],
  maxAge: 600
};

/**
 * CORS middleware for Node.js.
 * @example
 * ```ts
 * app.use(cors({ allowOrigins: ['*'], exposeHeaders: ['Authorization, ETag'] }));
 * ```
 */
export const cors = (config: CorsConfig = {}): RequestHandler => {
  const _cors = new Cors({ ...defaultCorsConfig, ...config });
  return (req: IncomingMessage, res: ServerResponse, next?: (e?: any) => any): void => {
    if (_cors.preflight(req, res, next)) {
      res.writeHead(204, { 'Content-Length': 0 }).end();
    } else {
      next?.();
    }
  };
};
