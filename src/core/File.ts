export interface File {
  bytesWritten: number;
  filename: string;
  id: string;
  metadata: Record<string, any>;
  mimeType: string;
  path: string;
  size: number;
  userId: string;
  status: 'created' | 'completed' | 'deleted' | 'error';
}
declare global {
  namespace Express {
    interface Request {
      file?: File;
    }
  }
}
