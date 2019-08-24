export interface File {
  bytesWritten: number;
  filename: string;
  id: string;
  metadata: Record<string, any>;
  mimeType: string;
  path: string;
  size: number;
  userId: string | null;
  status: 'created' | 'completed' | 'deleted';
}
export interface FilePart {
  userId: string | null;
  total?: number;
  end?: number;
  start: number;
  id: string;
}
