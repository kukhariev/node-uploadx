import { BaseHandler, BaseStorage, File } from '../../packages/core/src';
export class TestUploader extends BaseHandler<File, File[]> {
  storage = {
    path: '/files',
    isReady: true,
    get: (url: any) => Promise.resolve([]),
    normalizeError: (e: Error) => e
  } as unknown as BaseStorage<any, any>;
}
