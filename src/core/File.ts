import { createHash } from 'crypto';
import { uid } from './utils';

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
  constructor(public metadata: Metadata = {}) {
    const { name, type, mimeType, title, filename, filetype, size, lastModified } = metadata;
    this.filename = name || title || filename || uid();
    this.mimeType = mimeType || type || filetype || 'application/octet-stream';
    this.size = Number(size) || 0;
    this.lastModified = lastModified;
    this.timestamp = new Date().getTime();
  }
  generateId(): void {
    const { filename, size, lastModified, userId } = this;
    const ordered = [filename, size, lastModified, userId].join('-');
    this.id = createHash('md5')
      .update(JSON.stringify(ordered))
      .digest('hex');
  }
}
export interface FilePart {
  userId: string | null;
  total?: number;
  end?: number;
  start: number;
  id: string;
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
}
