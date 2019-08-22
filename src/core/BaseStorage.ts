import * as http from 'http';
import { File, Range } from './';

export abstract class BaseStorage {
  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  abstract update(req: http.IncomingMessage, range: Range): Promise<File>;
  abstract delete(file: Partial<File>): Promise<File[]>;
  abstract get(file: Partial<File>): Promise<File[]>;
}
