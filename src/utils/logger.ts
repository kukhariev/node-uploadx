import * as debug from 'debug';
const logger = debug('uploadx');

export class Logger {
  static get(namespace: string): any {
    return logger.extend(namespace.toLowerCase());
  }
}
