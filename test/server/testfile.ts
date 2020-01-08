import * as fs from 'fs';
import { join } from 'path';
import { File } from '../../src/storages';
import { userPrefix } from './index';
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
