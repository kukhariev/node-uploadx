import { BaseHandler, BaseStorage } from '../../packages/core/src';
export class TestUploader extends BaseHandler {
  storage = ({
    path: '/files',
    isReady: true,
    get: (url: any) => Promise.resolve([])
  } as unknown) as BaseStorage<any, any>;
}
