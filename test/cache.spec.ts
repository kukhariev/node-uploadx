import { Cache } from '@uploadx/core';

describe('Cache', () => {
  let cache: Cache<any>;

  beforeEach(() => {
    cache = new Cache(5, 500);
    for (let i = 0; i < 10; i++) {
      cache.set(`key-${i}`, i);
    }
  });

  it('should limit size', () => {
    expect(cache.get(`key-0`)).toBeUndefined();
    expect(cache.get(`key-9`)).toBe(9);
    expect(cache['_map'].size).toBe(5);
  });

  it('should expire', async () => {
    jest.useFakeTimers();
    jest.advanceTimersByTime(1000);
    expect(cache.get(`key-9`)).toBeUndefined();
    expect(cache['_map'].size).toBe(4);
  });
});
