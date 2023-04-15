import { IncomingMessage, ServerResponse } from 'http';
import { getHeader } from '../utils';

export interface CorsConfig {
  allowedMethods?: string[];
  allowedHeaders?: string[];
  maxAge?: number;
  allowOrigins?: string[];
  credentials?: boolean;
  exposeHeaders?: string[];
}

export class Cors {
  allowedHeaders: string[];
  allowedMethods: string[];
  allowOrigins: string[];
  credentials: boolean;
  exposeHeaders?: string[];
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
    this.allowOrigins[0] !== '*' && res.setHeader('Vary', 'Origin');
    this.credentials && res.setHeader('Access-Control-Allow-Credentials', 'true');
    const accessControlRequestMethod = getHeader(req, 'access-control-request-method');
    if (accessControlRequestMethod && req.method === 'OPTIONS') {
      // preflight
      res.setHeader(
        'Access-Control-Allow-Methods',
        this.allowedMethods.toString().toUpperCase() || accessControlRequestMethod
      );
      const allowedHeaders =
        this.allowedHeaders.toString() || getHeader(req, 'access-control-request-headers', true);
      allowedHeaders && res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
      res.setHeader('Access-Control-Max-Age', this.maxAge);
      return true;
    }
    // actual
    this.exposeHeaders?.length &&
      res.setHeader('Access-Control-Expose-Headers', this.exposeHeaders.join(','));
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

const defaultConfig: CorsConfig = {
  allowedMethods: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH'],
  maxAge: 600,
  allowOrigins: ['*']
};

type RequestHandler = (req: IncomingMessage, res: ServerResponse, next?: (e?: any) => any) => void;

export const cors = (config: CorsConfig = {}): RequestHandler => {
  const _cors = new Cors({ ...defaultConfig, ...config });
  return (req: IncomingMessage, res: ServerResponse, next?: (e?: any) => any): void => {
    if (_cors.preflight(req, res, next)) {
      res.writeHead(204, { 'Content-Length': 0 });
      res.end();
    } else {
      next?.();
    }
  };
};
