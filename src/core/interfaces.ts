import * as http from 'http';
import { BaseStorage } from '.';

export type NextFunction = (err?: Error) => void;

export interface Request extends http.IncomingMessage {
  body?: any;
  user?: any;
  file?: File;
}

export type Response = http.ServerResponse;

export interface Range {
  total?: number;
  end?: number;
  start: number;
  id: string;
}

export interface File {
  bytesWritten: number;
  filename: string;
  id: string;
  metadata: any;
  mimeType: string;
  path: string;
  size: number;
  userId: string;
  status: 'created' | 'completed' | 'deleted' | 'error';
}
export interface BaseConfig<T> extends DiskStorageConfig {
  storage?: BaseStorage<T>;
  allowMIME?: string[];
  maxUploadSize?: number | string;
  useRelativeURL?: boolean | string;
}
export interface StorageConfig {
  name?: string;
}

export type Destination = string | ((req: Request, file: File) => string);
export interface DiskStorageConfig extends StorageConfig {
  /**
   * Where uploaded files will be stored
   */
  destination?: Destination;
  /**
   *  Where uploaded files will be stored
   */
  dest?: Destination;
}
type HttpMethods = 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';
type HandlerMethods = 'create' | 'update' | 'delete' | 'read';
export type MethodsMap = {
  [x in HttpMethods]?: HandlerMethods;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      file: File;
    }
  }
}
