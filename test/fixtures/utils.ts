import * as rimraf from 'rimraf';
export const rm = (dir: string): void => rimraf.sync(dir);
