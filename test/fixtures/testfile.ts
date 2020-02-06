import { statSync } from 'fs';
import { join } from 'path';
import { File, METAFILE_EXTNAME } from '../../src';
import { userPrefix } from './index';
export const srcpath = join(__dirname, `testfile.mp4`);
const stat = statSync(srcpath);
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
