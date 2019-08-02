import * as http from 'http';
import { BaseStorage } from '.';

export type NextFunction = (err?: Error) => void;

export interface Request extends http.IncomingMessage {
  body?: any;
  user?: any;
  file?: File;
}

export interface Response extends http.ServerResponse {}

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
  status: 'created' | 'complete' | 'deleted' | 'error';
}
export interface StorageConfig {}
export interface UploadxConfig extends StorageConfig {
  storage?: BaseStorage;
  useRelativeURL?: boolean | string;
  allowMIME?: string[];
  maxChunkSize?: number | string;
  maxUploadSize?: number | string;
}
export type Destination = string | ((req: Request, file: File) => string);

export interface DiskStorageConfig {
  /**
   * Where uploaded files will be stored
   */
  destination?: Destination;
  /**
   *  Where uploaded files will be stored
   */
  dest?: Destination;
}

declare global {
  namespace Express {
    interface Request {
      file: File;
    }
  }
}
