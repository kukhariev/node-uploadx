import * as http from 'http';
import { Range, File } from '.';

export abstract class BaseStorage {
  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  abstract write(req: http.IncomingMessage, range: Range): Promise<File>;
  abstract delete(fileId: string): Promise<File>;

  /**
   * Return uploads array
   */
  list(req?: any): Promise<File[]> {
    return Promise.resolve([] as File[]);
  }
}
