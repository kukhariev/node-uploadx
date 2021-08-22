/**
 * LRU Cache Implementation
 */
export class Cache<T> {
  private _map = new Map<string, [value: T, expiresAt: number]>();

  /**
   *
   * @param maxEntries The maximum number of entries before the cache starts flushing out the old items
   * @param maxAge The maximum life of a cached items in seconds
   */
  constructor(public maxEntries = 500, public maxAge = 300) {}

  get(key: string): T | undefined {
    const [value, expiresAt] = this._map.get(key) || [];
    if (value) {
      this._map.delete(key);
      const now = Date.now();
      if (expiresAt && now > expiresAt) return;
      this._map.set(key, [value, now + this.maxAge * 1000]);
    }
    return value;
  }

  delete(key: string): boolean {
    return this._map.delete(key);
  }

  set(key: string, value: T): void {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size === this.maxEntries) this._map.delete(this._map.keys().next().value);
    this._map.set(key, [value, Date.now() + this.maxAge * 1000]);
  }
}
