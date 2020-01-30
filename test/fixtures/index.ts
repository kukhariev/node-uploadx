import * as fs from 'fs';
import { join } from 'path';
import { BaseStorageOptions, File, METAFILE_EXTNAME } from '../../src';
export const userPrefix = 'userId';

export const root = 'files';

export const srcpath = join(__dirname, `testfile.mp4`);
const stat = fs.statSync(srcpath);

export const metadata = {
  name: 'testfile.mp4',
  size: stat.size,
  mimeType: 'video/mp4',
  lastModified: Math.round(stat.mtimeMs)
};
export const testfile = {
  userId: userPrefix,
  name: `${userPrefix}/${metadata.name}`,
  originalName: metadata.name,
  size: stat.size,
  contentType: metadata.mimeType,
  metadata
} as File;

export const metafile = testfile.name + METAFILE_EXTNAME;
export const filename = testfile.name;

export const storageOptions: BaseStorageOptions = {
  filename: file => `${file.userId}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*', 'application/octet-stream'],
  useRelativeLocation: true
};
