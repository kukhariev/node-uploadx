import { BaseStorage } from '.';
import * as http from 'http';
export type EVENT = 'created' | 'complete' | 'deleted' | 'error';
export type NextFunction = (err?: Error) => void;
export interface Request extends http.IncomingMessage, Express.Request {
  body?: any;
  file?: File;
}
export interface Response extends http.ServerResponse, Express.Response {}
export interface Range {
  total?: number;
  end?: number;
  start?: number;
  id: string;
}
export interface File {
  bytesWritten: number;
  filename: string;
  id: string;
  metadata: any;
  mimeType: any;
  path: string;
  size: number;
  userId: string;
}

export interface UploadxConfig {
  allowMIME?: string[];
  maxChunkSize?: number | string;
  maxUploadSize?: number | string;
  storage?: BaseStorage;
  useRelativeURL?: boolean | string;
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
