import * as http from 'http';
import { File, Range, StorageConfig } from '.';

export abstract class BaseStorage<T extends StorageConfig> {
  options: T = ({} as unknown) as T;
  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  abstract update(req: http.IncomingMessage, range: Range): Promise<File>;
  abstract delete(fileId: string): Promise<File>;
  abstract read(req?: http.IncomingMessage): Promise<File[]>;
}
