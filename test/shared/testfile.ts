import { statSync } from 'fs';
import { join } from 'path';
import { File, Metadata, METAFILE_EXTNAME } from '../../packages/core/src';
import { userPrefix } from './config';

export const srcpath = join(__dirname, `testfile.mp4`);
const stat = statSync(srcpath);
export const metadata = {
  name: 'testfile.mp4',
  size: stat.size,
  mimeType: 'video/mp4',
  lastModified: Math.round(stat.mtimeMs),
  custom: ''
};
export const testfile = {
  userId: userPrefix,
  name: `${userPrefix}/${metadata.name}`,
  originalName: metadata.name,
  size: stat.size,
  contentType: metadata.mimeType,
  metadata: metadata as Metadata
} as File;
export const metafilename = testfile.name + METAFILE_EXTNAME;
export const filename = testfile.name;
