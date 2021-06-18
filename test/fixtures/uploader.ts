import { IncomingMessage } from 'http';
import { BaseHandler, BaseStorage, File, FileInit, FilePart } from '../../packages/core/src';

export class TestUploader extends BaseHandler<File, File[]> {}

class TestStorage extends BaseStorage<File, any> {
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

  get = (_url: any): Promise<any> => Promise.resolve([]);
}

export const testStorage = new TestStorage();
