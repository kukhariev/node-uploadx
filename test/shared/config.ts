import type { BaseStorageOptions, File } from '../../packages/core/src';

export const userPrefix = 'userId';

export const uploadRoot = 'files';

export const storageOptions: BaseStorageOptions<File> = {
  filename: file => `${file.userId || 'anonymous'}/${file.originalName}`,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  userIdentifier: req => req.user?.id,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*', 'application/octet-stream'],
  useRelativeLocation: true
};
