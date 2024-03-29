import {
  BaseHandler,
  BaseStorage,
  BaseStorageOptions,
  File,
  FileInit,
  FilePart,
  FileQuery,
  MetaStorage
} from '../../packages/core/src';

export class TestUploader extends BaseHandler<File> {}

export class TestStorage extends BaseStorage<File> {
  path = '/files';
  isReady = true;
  meta;

  constructor(config = {} as BaseStorageOptions<File>) {
    super(config);
    this.meta = new MetaStorage<File>(config);
  }

  create(req: any, file: FileInit): Promise<File> {
    return Promise.resolve(file as File);
  }

  write(part: FilePart | FileQuery): Promise<File> {
    return Promise.resolve(part as File);
  }

  delete(file: FileQuery): Promise<File[]> {
    return Promise.resolve([file as File]);
  }
}

export const testStorage = new TestStorage();
