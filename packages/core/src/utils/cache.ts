/**
 * LRU Cache Implementation
 */
export class Cache<T> {
  private _map = new Map<string, [value: T, expiresAt: number]>();

  /**
   *
   * @param limit The maximum number of entries before the cache starts flushing out the old items
   * @param ttl The maximum life of a cached items in milliseconds
   */
  constructor(public limit = 500, public ttl = 300_000) {}

  get(key: string): T | undefined {
    const [value, expiresAt] = this._map.get(key) || [];
    if (value) {
      this._map.delete(key);
      const now = Date.now();
      if (expiresAt && now > expiresAt) return;
      this._map.set(key, [value, now + this.ttl]);
    }
    return value;
  }

  delete(key: string): boolean {
    return this._map.delete(key);
  }

  set(key: string, value: T): void {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size === this.limit) this._map.delete(this._map.keys().next().value);
    this._map.set(key, [value, Date.now() + this.ttl]);
  }
}
