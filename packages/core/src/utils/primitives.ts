import { createHash, randomBytes } from 'crypto';
import duration from 'parse-duration';
import { isDeepStrictEqual } from 'util';
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
  const bytes = Buffer.from(str, 'utf8');
  for (const byte of bytes) {
    hash ^= byte;
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

/**
 * FNV1A64 hash
 */
export function fnv64(str: string): string {
  let hash = 14695981039346656037n;
  const offset = 1099511628211n;
  const bytes = Buffer.from(str, 'utf8');
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * offset);
  }
  return hash.toString(16);
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

export function isEqual(a: object, b: object, ...keysToIgnore: string[]): boolean {
  return isDeepStrictEqual(
    Object.entries(a).filter(e => !keysToIgnore.includes(e[0])),
    Object.entries(b).filter(e => !keysToIgnore.includes(e[0]))
  );
}
export function isNumber(x?: unknown): x is number {
  return x === Number(x);
}

export function isRecord(x: unknown): x is Record<any, any> {
  // return Object.prototype.toString.call(x) === '[object Object]';
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export function extendObject<T extends Record<any, any>>(target: T, ...sources: Partial<T[]>): T {
  if (!sources.length) return target;
  const source = sources.shift();
  if (isRecord(source)) {
    for (const key in source) {
      if (isRecord(source[key])) {
        if (!isRecord(target[key])) Object.assign(target, { [key]: {} });
        extendObject(target[key] as any, source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return extendObject(target, ...sources);
}
/**
 * Convert a human-readable duration to ms
 */
export function toMilliseconds(value: string | number | undefined): number | null {
  if (isNumber(value)) return value;
  if (!value) return null;
  return duration(value);
}
/**
 * Convert a human-readable duration to seconds
 */
export function toSeconds(value: string | number): number {
  if (isNumber(value)) return value;
  return duration(value, 'sec');
}

/**
 * Returns a first element of an array
 */
export function getFirstOne<T>(val: T[]): T {
  return val[0];
}

/**
 * Returns a last element of an array
 */
export function getLastOne<T>(val: T[]): T {
  return val[val.length - 1];
}

/**
 * Returns a function that caches the result of func
 * @param fn - function to be called
 */
export const memoize = <T, K>(fn: (arg: T) => K): ((arg: T) => K) => {
  const cache = new Cache<K>(1000);
  return (arg: T): K => {
    const key = JSON.stringify(arg);
    let result = cache.get(key);
    if (result === undefined && !cache.has(key)) {
      result = fn(arg);
      cache.set(key, result);
    }
    return result as K;
  };
};

export const hash = memoize(fnv64);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function deepMask(keysToMask: string[], replacement: string | ((v: any) => any) = '*****') {
  const r = typeof replacement === 'string' ? () => replacement : replacement;
  return function mask<T extends Record<string, any>>(obj: T): T {
    const masked = { ...obj };
    for (const key in masked) {
      if (keysToMask.includes(key)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        masked[key] = r(masked[key]);
      } else if (isRecord(masked[key])) {
        masked[key] = mask(masked[key]);
      }
    }
    return masked;
  };
}

export function maskTokens(
  obj: Record<string, unknown>,
  keysToMask: string[]
): Record<string, unknown> {
  const masked = { ...obj };
  for (const key of keysToMask) {
    if (key in masked) {
      masked[key] = '*****';
    }
  }
  return masked;
}
