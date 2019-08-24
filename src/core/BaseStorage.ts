import * as http from 'http';
import { File, FilePart } from './';

export abstract class BaseStorage {
  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  abstract write(req: http.IncomingMessage, range: FilePart): Promise<File>;
  abstract delete(file: Partial<File>): Promise<File[]>;
  abstract get(file: Partial<File>): Promise<File[]>;
}
