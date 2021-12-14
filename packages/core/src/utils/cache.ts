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
    const [value, expiresAt] = this._map.get(key) || [];
    if (value) {
      this._map.delete(key);
      if (expiresAt && Date.now() > expiresAt) return;
      this._map.set(key, [value, this._expiry]);
    }
    return value;
  }

  delete(key: string): boolean {
    return this._map.delete(key);
  }

  set(key: string, value: T): T {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size === this.maxEntries)
      this._map.delete(this._map.keys().next().value as string);
    this._map.set(key, [value, this._expiry]);
    return value;
  }
}
