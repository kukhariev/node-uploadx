import { debug } from 'debug';

type LoggerInstance = ((label?: any, ...data: any[]) => void) & { enabled?: boolean };

export class Logger {
  static get(namespace: string): LoggerInstance {
    return debug('uploadx').extend(namespace.toLowerCase());
  }
}
