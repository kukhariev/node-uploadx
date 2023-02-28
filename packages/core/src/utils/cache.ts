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
  constructor(public maxEntries = 1000, readonly maxAge = 86400) {
    this._ttl = maxAge * 1000;
  }

  private get _expiry(): number {
    return this._ttl && Date.now() + this._ttl;
  }

  /**
   * If the cache has a TTL, return an array of keys that have not expired, otherwise return an array
   * of all keys
   * @returns An array of all the keys in the map.
   */
  keys(): string[] {
    if (this._ttl) {
      const actualKeys: string[] = [];
      const now = Date.now();

      this._map.forEach(([, expiresAt], key) => {
        if (now < expiresAt) {
          actualKeys.push(key);
        } else {
          this._map.delete(key);
        }
      });

      return actualKeys;
    }
    return Array.from(this._map.keys());
  }

  getAllKeys(): string[] {
    return Array.from(this._map.keys());
  }

  /**
   * Get an item from the cache
   * @param key - The key to look up
   * @returns The cached value or undefined if it is not found or expired
   */
  get(key: string): T | undefined {
    const tuple = this._map.get(key);
    if (!tuple) return;
    if (!this._ttl) return tuple[0];
    this._map.delete(key);
    if (Date.now() > tuple[1]) return;
    this._map.set(key, [tuple[0], this._expiry]);
    return tuple[0];
  }

  /**
   * Check if an item is exist and if it is not expired
   * @param key - The key to look up
   */
  has(key: string): boolean {
    const tuple = this._map.get(key);
    if (!tuple) return false;
    if (!this._ttl) return true;
    if (Date.now() > tuple[1]) {
      this._map.delete(key);
      return false;
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
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size === this.maxEntries)
      this._map.delete(this._map.keys().next().value as string);
    this._map.set(key, [value, this._expiry]);
    return value;
  }

  /**
   * Delete the key from the cache
   * @param - The key of the item to remove from the cache
   */
  delete(key: string): boolean {
    return this._map.delete(key);
  }
}
