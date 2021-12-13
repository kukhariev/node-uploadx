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
    return Promise.resolve(file as File);
  }

  write(part: FilePart): Promise<File> {
    return Promise.resolve(part as File);
  }

  delete({ id }: FilePart): Promise<File[]> {
    return Promise.resolve([{ id } as File]);
  }
}

export const testStorage = new TestStorage();
