import * as http from 'http';
import { File, Range } from '.';

export abstract class BaseStorage {
  constructor(public options) {}
  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  abstract write(req: http.IncomingMessage, range: Range): Promise<File>;
  abstract delete(fileId: string): Promise<File>;

  /**
   * Return uploads list
   */
  list(req?: any): Promise<Record<string, File>>;
  list(req?: any): Promise<File[]>;
  list(req?: any): Promise<File>;
  list(req?: any): Promise<Record<string, File> | File[] | File> {
    return Promise.resolve({} as Record<string, File>);
  }
}
