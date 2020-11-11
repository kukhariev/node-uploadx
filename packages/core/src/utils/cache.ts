export class Cache<T> {
  private _map: Map<string, T> = new Map() as Map<string, T>;

  constructor(public limit = 100) {}

  private get _head(): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this._map.keys().next().value;
  }

  get(key: string): T | undefined {
    const item = this._map.get(key);
    if (item) {
      this._map.delete(key);
      this._map.set(key, item);
    }
    return item;
  }

  delete(key: string): boolean {
    return this._map.delete(key);
  }

  set(key: string, val: T): void {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size === this.limit) this._map.delete(this._head);
    this._map.set(key, val);
  }
}
