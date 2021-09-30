import * as rimraf from 'rimraf';

export function cleanup(directory: string): Promise<any> {
  return new Promise(resolve => rimraf(directory, resolve));
}
