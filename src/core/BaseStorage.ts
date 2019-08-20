import * as http from 'http';
import { File, Range } from './';

export interface StorageOptions {
  type?: string;
}
export abstract class BaseStorage {
  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  abstract update(req: http.IncomingMessage, range: Range): Promise<File>;
  abstract delete(fileId: string, userId: string): Promise<any>;
  abstract read(fileId?: string): Promise<any>;
}
