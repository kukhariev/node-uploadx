import { IncomingMessage } from 'http';
import {
  BaseHandler,
  BaseStorage,
  File,
  FileInit,
  FilePart,
  MetaStorage
} from '../../packages/core/src';

export class TestUploader extends BaseHandler<File> {}

export class TestStorage extends BaseStorage<File> {
  meta = new MetaStorage<File>();
  path = '/files';
  isReady = true;

  constructor() {
    super({});
  }

  create(req: IncomingMessage, file: FileInit): Promise<File> {
    throw new Error('Method not implemented.');
  }

  write(part: FilePart): Promise<File> {
    throw new Error('Method not implemented.');
  }

  delete(prefix: string): Promise<File[]> {
    throw new Error('Method not implemented.');
  }

  update(name: string, file: Partial<File>): Promise<File> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  list = (_url: any): Promise<any> => Promise.resolve({ uploads: [] });
}

export const testStorage = new TestStorage();
