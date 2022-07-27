import { BaseStorageOptions, File, METAFILE_EXTNAME } from '../../packages/core/src';
import { Readable } from 'stream';
import { checksum, randomString } from './utils';

export const userId = 'userId';

export const testRoot = '/tmp/uploadx/tests';

export const storageOptions: BaseStorageOptions<File> = {
  filename: file => `${file.userId || 'anonymous'}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*', 'application/octet-stream'],
  useRelativeLocation: true,
  expiration: { maxAge: '1h' }
};

async function* generateChunks(): AsyncIterableIterator<string> {
  yield 'xz'.repeat(16);
  yield 'xz'.repeat(16);
}
const id = 'f7d13faa74e2475f-e8fed598250d10ea-7f59007b4b7cf67-120941ca7dc37b78';
const contentType = 'video/mp4';
const fileAsBuffer = Buffer.from('xz'.repeat(32));
const size = Buffer.byteLength(fileAsBuffer);
const sha1 = checksum(fileAsBuffer, 'sha1');

export const metadata = {
  name: 'testfile.mp4',
  size,
  mimeType: 'video/mp4',
  lastModified: 1635398061454,
  custom: '',
  sha1
};

export const testfile = {
  ...metadata,
  filename: metadata.name,
  metafilename: id + METAFILE_EXTNAME,
  contentType: metadata.mimeType,
  asBuffer: fileAsBuffer,
  get asReadable() {
    return Readable.from(generateChunks());
  }
};

export const metafile = {
  bytesWritten: null as number | null,
  name: 'userId/testfile.mp4',
  originalName: 'testfile.mp4',
  metadata,
  contentType,
  size,
  userId,
  id
} as File;

export function getNewFileMetadata(name?: string): typeof metadata {
  name = name || `${randomString()}.mp4`;
  return { ...metadata, name };
}
