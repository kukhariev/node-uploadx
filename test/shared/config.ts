import type { BaseStorageOptions, File } from '../../packages/core/src';
import * as path from 'path';
import { tmpdir } from 'os';

export const userId = 'userId';

export const uploadRoot = path.join(tmpdir(), 'files');

export const storageOptions: BaseStorageOptions<File> = {
  filename: file => `${file.userId || 'anonymous'}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*', 'application/octet-stream'],
  useRelativeLocation: true,
  expiration: { maxAge: '1h' }
};
