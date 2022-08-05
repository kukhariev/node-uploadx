import { Cache } from './index';

export class Locker extends Cache<string> {
  lock(key: string): string {
    const locked = this.get(key);
    if (locked) {
      throw new Error(`${key} is locked`);
    }
    this.set(key, key);
    return key;
  }

  unlock(key: string): void {
    this.delete(key);
  }
}
