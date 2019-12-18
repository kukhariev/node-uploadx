import { Readable } from 'stream';
import { uid, md5 } from '../utils';

const generateFileId = (file: File): string => {
  const { originalName, size, userId, metadata } = file;
  return metadata.lastModified
    ? md5([originalName, size, metadata.lastModified, userId || ''].join('-'))
    : uid();
};
export interface FileInit {
  contentType?: string;
  originalName?: string;
  metadata?: Metadata;
  size?: number | string;
  userId?: string;
}
export class File implements FileInit {
  bytesWritten = 0;
  contentType: string;
  originalName: string;
  id = '';
  metadata: Metadata;
  name = '';
  size: number;
  status?: 'created' | 'completed' | 'deleted' | 'part';
  uri = '';
  userId?: any;

  constructor(opts: FileInit) {
    this.metadata = opts.metadata || {};
    const {
      title,
      originalName,
      filename,
      name,
      type,
      mimeType,
      contentType,
      filetype,
      size
    } = this.metadata;
    this.originalName =
      opts.originalName || name || title || originalName || filename || (this.id = uid());
    this.contentType =
      opts.contentType || contentType || mimeType || type || filetype || 'application/octet-stream';
    this.size = Number(opts.size || size) || 0;
    this.userId = opts.userId || null;
    this.id = this.id || generateFileId(this);
  }
}

export interface FilePart {
  body?: Readable;
  contentLength?: number;
  name: string;
  size?: number;
  start?: number;
}

export interface Metadata {
  [key: string]: any;
  size?: string | number;
  name?: string;
  type?: string;
  filetype?: string;
  mimeType?: string;
  contentType?: string;
  title?: string;
  filename?: string;
  lastModified?: string | number;
}
