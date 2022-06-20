import type { BaseStorageOptions, File } from '../../packages/core/src';
import { METAFILE_EXTNAME } from '../../packages/core/src';
import * as path from 'path';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { hash } from './utils';

export const userId = 'userId';

export const testRoot = path.join(tmpdir(), 'files');

export const storageOptions: BaseStorageOptions<File> = {
  filename: file => `${file.userId || 'anonymous'}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*', 'application/octet-stream'],
  useRelativeLocation: true,
  expiration: { maxAge: '1h' }
};

const id = '11f967df-da1013ca-385ed251-b9682398';
const size = 80495;
const contentType = 'video/mp4';
const fileAsBuffer = Buffer.from(Array(size).fill(5));
const fileAsReadStream = Readable.from(fileAsBuffer);
const sha1 = hash(fileAsBuffer, 'sha1');

export const metadata = {
  name: 'testfile.mp4',
  size: 80495,
  mimeType: 'video/mp4',
  lastModified: 1635398061454,
  custom: '',
  sha1
};
export const testfile = {
  ...metadata,
  filename: metadata.name,
  metafilename: id + METAFILE_EXTNAME,
  asBuffer: fileAsBuffer,
  asReadable: fileAsReadStream,
  contentType: metadata.mimeType
};
export const metafile = {
  bytesWritten: null as number | null,
  name: 'userId/testfile.mp4',
  metadata,
  originalName: 'testfile.mp4',
  contentType,
  size,
  userId,
  id
} as File;
