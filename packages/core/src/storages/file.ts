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

export type UploadEventType = 'created' | 'completed' | 'deleted' | 'part';

export class File implements FileInit {
  bytesWritten = NaN;
  contentType;
  originalName;
  id;
  metadata: Metadata;
  name = '';
  size;
  status?: UploadEventType;
  userId?;

  constructor({ metadata = {}, originalName, contentType, size, userId }: FileInit) {
    this.metadata = metadata;
    this.originalName = originalName || extractOriginalName(this.metadata) || (this.id = uid());
    this.contentType = contentType || extractMimeType(this.metadata) || 'application/octet-stream';
    this.size = Number(size || this.metadata.size) || 0;
    this.userId = userId;
    this.id ||= generateFileId(this);
  }
}

export interface FilePart {
  body?: Readable;
  contentLength?: number;
  name: string;
  size?: number;
  start?: number;
}

interface HasContent {
  start: number;
  body: Readable;
}

export function hasContent(part: Partial<FilePart>): part is HasContent {
  return typeof part.start === 'number' && part.start >= 0 && !!part.body;
}

export interface Metadata {
  [key: string]: any;
  size?: string | number;
  name?: string;
  filetype?: string;
  type?: string;
  mimeType?: string;
  contentType?: string;
  title?: string;
  filename?: string;
  originalName?: string;
  lastModified?: string | number;
}
