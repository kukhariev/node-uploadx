import * as http from 'http';
import { File, Range } from '.';

export abstract class BaseStorage {
  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  abstract update(req: http.IncomingMessage, range: Range): Promise<File>;
  abstract delete(fileId: string): Promise<File>;

  abstract read(fileId?: string): any;
}
