import { Readable } from 'stream';
import { md5, uid } from '../utils';

export function extractOriginalName(meta: Metadata): string | undefined {
  return meta.name || meta.title || meta.originalName || meta.filename;
}

export function extractMimeType(meta: Metadata): string | undefined {
  return meta.mimeType || meta.contentType || meta.type || meta.filetype;
}

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
    this.originalName =
      opts.originalName || extractOriginalName(this.metadata) || (this.id = uid());
    this.contentType =
      opts.contentType || extractMimeType(this.metadata) || 'application/octet-stream';
    this.size = Number(opts.size || this.metadata.size) || 0;
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
  filetype?: string;
  mimeType?: string;
  contentType?: string;
  title?: string;
  filename?: string;
  lastModified?: string | number;
}
