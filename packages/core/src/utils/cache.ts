/**
 * LRU Cache Implementation
 */
export class Cache<T> {
  private readonly _ttl: number;
  private _map = new Map<string, [value: T, expiresAt: number]>();

  /**
   * @param maxEntries - The maximum number of entries before the cache starts flushing out the old items
   * @param maxAge - The maximum life of a cached items in seconds
   */
  constructor(public maxEntries = 1000, readonly maxAge = 0) {
    this._ttl = maxAge * 1000;
  }

  private get _expiry(): number {
    return this._ttl && Date.now() + this._ttl;
  }

  get(key: string): T | undefined {
    const tuple = this._map.get(key);
    if (!tuple) return;
    this._map.delete(key);
    if (tuple[1] && Date.now() > tuple[1]) return;
    this._map.set(key, [tuple[0], this._expiry]);
    return tuple[0];
  }

  has(key: string): boolean {
    const tuple = this._map.get(key);
    if (!tuple) return false;
    if (tuple[1] && Date.now() > tuple[1]) {
      this._map.delete(key);
      return false;
    }
    return true;
  }

  set(key: string, value: T): T {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size === this.maxEntries)
      this._map.delete(this._map.keys().next().value as string);
    this._map.set(key, [value, this._expiry]);
    return value;
  }

  delete(key: string): boolean {
    return this._map.delete(key);
  }
}
