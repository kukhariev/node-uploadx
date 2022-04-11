import { join } from 'path';
import { File, METAFILE_EXTNAME } from '../../packages/core/src';
import { userId } from './config';

export const srcpath = join(__dirname, `testfile.mp4`);
export const id = '11f967df-da1013ca-385ed251-b9682398';

export const metadata = {
  name: 'testfile.mp4',
  size: 80495,
  mimeType: 'video/mp4',
  lastModified: 1635398061454,
  custom: '',
  sha1: 'YD5eezxkTfmNFCZ2SUA+ZjYcLyg='
};

export const testfile = {
  bytesWritten: null as unknown as number,
  name: 'userId/testfile.mp4',
  metadata,
  originalName: 'testfile.mp4',
  contentType: 'video/mp4',
  size: 80495,
  userId,
  id
} as File;

export const metafilename = id + METAFILE_EXTNAME;
export const filename = testfile.name;
