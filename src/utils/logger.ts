/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
export class Logger {
  static get(namespace: string): ((...par: any[]) => void) & { enabled: boolean } {
    return require('debug')('uploadx').extend(namespace.toLowerCase());
  }
}
