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
  path = '/files';
  isReady = true;
  meta = new MetaStorage<File>();
  constructor() {
    super({});
  }

  create(req: any, file: FileInit): Promise<File> {
    throw new Error('Method not implemented.');
  }

  write(part: FilePart): Promise<File> {
    throw new Error('Method not implemented.');
  }

  delete(id: string): Promise<File[]> {
    throw new Error('Method not implemented.');
  }
}

export const testStorage = new TestStorage();
