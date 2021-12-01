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
    expect(cache.get(`key-0`)).toBeUndefined();
    expect(cache.get(`key-9`)).toBe(9);
    expect(cache['_map'].size).toBe(5);
  });

  it('should expire', async () => {
    cache = new Cache(5, 60);
    fill();
    jest.useFakeTimers();
    jest.advanceTimersByTime(100_000);
    expect(cache.get(`key-9`)).toBeUndefined();
    expect(cache['_map'].size).toBe(4);
  });

  it('should not expire if maxAge is 0', async () => {
    cache = new Cache(5, 0);
    fill();
    jest.useFakeTimers();
    jest.advanceTimersByTime(100_000);
    expect(cache.get(`key-9`)).toBe(9);
    expect(cache['_map'].size).toBe(5);
  });
});
