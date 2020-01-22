export class Logger {
  static get(namespace: string): any {
    return require('debug')('uploadx').extend(namespace.toLowerCase());
  }
}
