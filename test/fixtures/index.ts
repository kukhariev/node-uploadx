import { BaseStorageOptions } from '../../src';
export const userPrefix = 'userId';

export const root = 'files';

export const storageOptions: BaseStorageOptions = {
  filename: file => `${file.userId}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*', 'application/octet-stream'],
  useRelativeLocation: true
};
