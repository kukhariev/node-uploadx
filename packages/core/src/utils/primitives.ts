import { createHash, randomBytes } from 'crypto';
import duration from 'parse-duration';
import { Cache } from './cache';

export const pick = <T, K extends keyof T>(obj: T, whitelist: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  whitelist.forEach(key => (result[key] = obj[key]));
  return result;
};

export const uid = (): string => randomBytes(16).toString('hex');

export function md5(str: string): string {
  return createHash('md5').update(str).digest('hex');
}

/**
 * FNV1A32 hash
 */
export function fnv(str: string): string {
  let hash = 2166136261;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function mapValues<T>(
  object: Record<string, any>,
  func: (value: any) => T
): Record<string, T> {
  const result: Record<string, T> = {};
  const keys = Object.keys(object);
  for (const key of keys) {
    result[key] = func(object[key]);
  }
  return result;
}

export function isMatch<T>(a: T, b: T, ...omit: string[]): boolean {
  return (
    Object.entries(a)
      .filter(e => !omit.includes(e[0]))
      .toString() ===
    Object.entries(b)
      .filter(e => !omit.includes(e[0]))
      .toString()
  );
}
export function isNumber(x?: unknown): x is number {
  return x === Number(x);
}

export function isRecord(x: unknown): x is Record<any, any> {
  // return Object.prototype.toString.call(x) === '[object Object]';
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Convert a human-readable duration to ms
 */
export function toMilliseconds(value: string | number | undefined): number | null {
  if (isNumber(value)) return value;
  if (!value) return null;
  return duration(value);
}

export function first<T>(val: T | T[]): T {
  return Array.isArray(val) ? val[0] : val;
}

export const memoize = <T, K>(fn: (val: T) => K): ((val: T) => K) => {
  const cache = new Cache<K>(1000, 0);
  const cached = (val: T): K => {
    const key = JSON.stringify(val);
    return cache.get(key) || cache.set(key, fn.call(this, val));
  };
  cached.cache = cache;
  return cached;
};

export const hash = memoize(fnv);
