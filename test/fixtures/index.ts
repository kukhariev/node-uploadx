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
  originalName: 'testfile.mp4',
  size: stat.size,
  contentType: 'video/mp4',
  metadata
} as File;

export const filename = `${testfile.userId}/${testfile.originalName}`;
export const metafile = filename + METAFILE_EXTNAME;

export const storageOptions: BaseStorageOptions = {
  filename: file => `${file.userId}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*', 'application/octet-stream'],
  useRelativeLocation: true
};
