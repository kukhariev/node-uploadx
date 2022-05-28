import { Readable } from 'stream';
import { hash, isRecord, uid } from '../utils';
import { isAbsolute } from 'path';

export function isExpired(file: File): boolean {
  if (!file.expiredAt) return false;
  return Date.now() > +new Date(file.expiredAt);
}

export function extractOriginalName(meta: Metadata): string | undefined {
  return meta.name || meta.title || meta.originalName || meta.filename;
}

export function extractMimeType(meta: Metadata): string | undefined {
  return meta.mimeType || meta.contentType || meta.type || meta.filetype;
}

const generateFileId = (file: File): string => {
  const { originalName, size, userId, metadata } = file;
  const mtime = String(metadata.lastModified || Date.now());
  return [userId, originalName, size, mtime].filter(Boolean).map(String).map(hash).join('-');
};

export interface FileInit {
  contentType?: string;
  originalName?: string;
  metadata: Metadata;
  size?: number | string;
  userId?: string;
}

export type UploadxEventType = 'created' | 'completed' | 'deleted' | 'part' | 'updated';

export class File implements FileInit {
  bytesWritten = NaN;
  contentType;
  originalName;
  id;
  metadata: Metadata;
  name = '';
  size;
  status?: UploadxEventType;
  userId?;
  expiredAt?: string | Date | number;
  createdAt?: string | Date | number;

  constructor({ metadata = {}, originalName, contentType, size, userId }: FileInit) {
    this.metadata = metadata;
    this.originalName = originalName || extractOriginalName(metadata) || (this.id = uid());
    this.contentType = contentType || extractMimeType(metadata) || 'application/octet-stream';
    this.size = Number(size || metadata.size);
    this.userId = userId;
    this.id ||= generateFileId(this);
  }
}

export type UploadxFile = Readonly<File>;

export interface FilePart extends Checksum {
  body?: Readable;
  contentLength?: number;
  id: string;
  size?: number;
  start?: number;
  userId?: string;
}

interface HasContent {
  start: number;
  body: Readable;
}

export function hasContent(part: Partial<FilePart>): part is HasContent {
  return typeof part.start === 'number' && part.start >= 0 && !!part.body;
}

export function isValidPart(part: FilePart, file: File): boolean {
  return (part.start || 0) + (part.contentLength || 0) <= file.size;
}

/** User-provided metadata */
export class Metadata {
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

export function isMetadata(raw: unknown): raw is Metadata {
  return isRecord(raw);
}

export function updateMetadata(file: File, metadata: unknown): void {
  if (isMetadata(file.metadata) && isMetadata(metadata)) {
    file.metadata = { ...file.metadata, ...metadata };
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
  } else {
    file.metadata = metadata as Metadata;
  }
}

export function getFileStatus(file: File): UploadxEventType {
  return file.bytesWritten === file.size ? 'completed' : !file.createdAt ? 'created' : 'part';
}

export class FileName {
  static INVALID_CHARS = ['"', '*', ':', '<', '>', '?', '\\', '|', '../'];
  static INVALID_PREFIXES: string[] = [];
  static INVALID_SUFFIXES: string[] = [];
  static MAX_LENGTH = 255;
  static MIN_LENGTH = 3;
  static isValid(name: string): boolean {
    if (
      !name ||
      name.length < FileName.MIN_LENGTH ||
      name.length > FileName.MAX_LENGTH ||
      isAbsolute(name)
    ) {
      return false;
    } else {
      const upperCase = name.toUpperCase();
      return !(
        FileName.INVALID_CHARS.filter(Boolean).some(chars => upperCase.includes(chars)) ||
        FileName.INVALID_PREFIXES.filter(Boolean).some(chars => upperCase.startsWith(chars)) ||
        FileName.INVALID_SUFFIXES.filter(Boolean).some(chars => upperCase.endsWith(chars))
      );
    }
  }
}

export type Checksum = {
  checksum?: string;
  checksumAlgorithm?: string;
};
