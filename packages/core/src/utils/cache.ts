/**
 * Time-aware LRU Cache Implementation
 */
export class Cache<T> {
  private readonly _ttl: number;
  private _map = new Map<string, [value: T, expiresAt: number]>();

  /**
   * @param maxEntries - The maximum number of entries before the cache starts flushing out the old items
   * @param maxAge - The maximum life of a cached items in seconds
   */
  constructor(
    public maxEntries = 1000,
    readonly maxAge?: number
  ) {
    this._ttl = maxAge ? maxAge * 1000 : 0;
  }

  /**
   * @returns the total number of cache entries, including expired ones
   */
  get size(): number {
    return this._map.size;
  }

  /**
   * Cache keys iterator
   * @returns an iterator of all keys in a cache
   */
  keys(): IterableIterator<string> {
    return this._map.keys();
  }

  /**
   * Remove expired entries
   * @returns array of actual keys
   */
  prune(): string[] {
    if (this._ttl) {
      const now = Date.now();
      for (const [key, [, expiresAt]] of this._map) {
        if (now > expiresAt) this._map.delete(key);
      }
    }
    while (this._map.size > this.maxEntries) {
      this._map.delete(this._map.keys().next().value as string);
    }
    return Array.from(this._map.keys());
  }

  clear(): void {
    this._map.clear();
  }

  /**
   * Get an item from the cache
   * @param key - The key to look up
   * @returns The cached value or undefined if it is not found or expired
   */
  get(key: string): T | undefined {
    const tuple = this._map.get(key);
    if (!tuple) return;
    this._map.delete(key);
    if (this._ttl) {
      const now = Date.now();
      if (now > tuple[1]) return;
      tuple[1] = now + this._ttl;
    }
    this._map.set(key, tuple);
    return tuple[0];
  }

  /**
   * Check if the item exists and has not expired
   * @param key - The key to look up
   */
  has(key: string): boolean {
    const tuple = this._map.get(key);
    if (!tuple) return false;
    if (this._ttl) {
      if (Date.now() > tuple[1]) {
        this._map.delete(key);
        return false;
      }
    }
    return true;
  }

  /**
   * Add the new key and value to the cache
   * @param key - The key to store the value under
   * @param value - The value to be stored in the cache
   * @returns The value that was set
   */
  set(key: string, value: T): T {
    if (this._map.size === this.maxEntries)
      this._map.delete(this._map.keys().next().value as string);
    const expiresAt = this._ttl ? Date.now() + this._ttl : 0;
    this._map.set(key, [value, expiresAt]);
    return value;
  }

  /**
   * Delete the key from the cache
   * @param key - The key of the item to remove from the cache
   */
  delete(key: string): boolean {
    return this._map.delete(key);
  }
}
