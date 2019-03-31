import * as http from 'http';
import { Range, File } from '.';

export abstract class BaseStorage {
  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  /**
   *
   * @param req
   * @param range
   */
  abstract write(req: http.IncomingMessage, range: Range): Promise<File>;
  abstract delete(fileId: string): Promise<File>;
}
