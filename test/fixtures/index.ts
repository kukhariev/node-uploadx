import type { BaseStorageOptions, File } from '../../packages/core/src';
export const userPrefix = 'userId';

export const root = 'files';

export const storageOptions: BaseStorageOptions<File> = {
  filename: file => `${file.userId || 'anonymous'}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*', 'application/octet-stream'],
  useRelativeLocation: true
};
