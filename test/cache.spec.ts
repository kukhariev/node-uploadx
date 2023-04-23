import { Cache } from '../packages/core/src';

describe('Cache', () => {
  let cache: Cache<number>;

  const fill = (): void => {
    for (let i = 0; i < 10; i++) {
      cache.set(`key-${i}`, i);
    }
  };

  it('should limit size', () => {
    cache = new Cache(5, 60);
    fill();
    expect(cache.get('key-0')).toBeUndefined();
    expect(cache.get('key-9')).toBe(9);
    expect(cache.size).toBe(5);
  });

  it('should lru', () => {
    cache = new Cache(5);
    fill();
    cache.get('key-9');
    cache.set('key-10', 10);
    cache.set('key-11', 11);
    cache.set('key-12', 12);
    expect(Array.from(cache.keys())).toEqual(['key-8', 'key-9', 'key-10', 'key-11', 'key-12']);
  });

  it('should expire', async () => {
    cache = new Cache(5, 60);
    fill();
    jest.useFakeTimers();
    jest.advanceTimersByTime(100_000);
    expect(cache.get('key-9')).toBeUndefined();
    expect(cache.size).toBe(4);
    jest.useRealTimers();
  });

  it('should not expire if maxAge is 0', async () => {
    cache = new Cache(5, 0);
    fill();
    jest.useFakeTimers();
    jest.advanceTimersByTime(100_000);
    expect(cache.get('key-9')).toBe(9);
    expect(cache.size).toBe(5);
    jest.useRealTimers();
  });

  it('should prune', () => {
    cache = new Cache(10, 60);
    fill();
    expect(cache.size).toBe(10);
    cache.maxEntries = 5;
    expect(cache.prune()).toHaveLength(5);
    jest.useFakeTimers();
    jest.advanceTimersByTime(100_000);
    expect(cache.size).toBe(5);
    expect(cache.prune()).toHaveLength(0);
    jest.useRealTimers();
  });
});
