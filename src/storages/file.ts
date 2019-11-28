import { createHash } from 'crypto';
import { Readable } from 'stream';
import { uid } from '../util/utils';

export class File {
  bytesWritten = 0;
  filename: string;
  id = '';
  mimeType: string;
  path = '';
  size: number;
  lastModified?: string | number;
  userId: string | null = null;
  status?: 'created' | 'completed' | 'deleted' | 'part';
  timestamp: number;
  link?: string;

  constructor(public metadata: Metadata = {}) {
    const {
      name,
      type,
      mimeType,
      title,
      filename,
      filetype,
      size,
      byteCount,
      lastModified
    } = metadata;
    this.filename = name || title || filename || uid();
    this.mimeType = mimeType || type || filetype || 'application/octet-stream';
    this.size = Number(size || byteCount) || 0;
    this.lastModified = lastModified;
    this.timestamp = new Date().getTime();
  }
}

export const generateFileId = (file: File): string => {
  const { filename, size, lastModified, userId, timestamp = new Date().getTime() } = file;
  const ordered = [filename, size, lastModified || timestamp, userId].join('-');
  return createHash('md5')
    .update(JSON.stringify(ordered))
    .digest('hex');
};

export interface FilePart {
  body?: Readable;
  start?: number;
  contentLength?: number;
  path: string;
  size?: number;
}

export interface Metadata {
  size?: string | number;
  name?: string;
  type?: string;
  filetype?: string;
  mimeType?: string;
  title?: string;
  filename?: string;
  lastModified?: string | number;
  userId?: string | null;

  [key: string]: string | number | undefined | null;
}
