import * as http from 'http';
import { BaseStorage } from './base-storage';

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
export type AsyncHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<File>;

export interface BaseConfig {
  storage?: BaseStorage;
  allowMIME?: string[];
  maxUploadSize?: number | string;
}
export interface StorageOptions {
  type?: string;
}

export type Destination = string | (<T extends http.IncomingMessage>(req: T, file: File) => string);

export interface DiskStorageOptions extends StorageOptions {
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
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      file: File;
    }
  }
}
