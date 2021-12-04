import { createHash, randomBytes } from 'crypto';
import duration from 'parse-duration';

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
 * 32-bit FNV-1a hash function
 */
export function fnv(str: string): number {
  let hash = 2166136261;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

type Fns<T> = (arg: any) => T;

export const pipeFunc = <T>(...fns: Fns<T>[]): Fns<T> =>
  fns.reduce(
    (fn, next) =>
      (...args) =>
        next(fn(...args))
  );

export function mapValues<T>(obj: Record<string, any>, ...fns: Fns<T>[]): Record<string, T> {
  const piped = pipeFunc(...fns);
  const result: Record<string, T> = {};
  const keys = Object.keys(obj);
  for (const key of keys) {
    result[key] = piped(obj[key]);
  }
  return result;
}

export function isNumber(x?: unknown): x is number {
  return x === Number(x);
}

export function isRecord(x: unknown): x is Record<any, any> {
  // return Object.prototype.toString.call(x) === '[object Object]';
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export const isEmpty = (val: object | null | undefined): boolean =>
  !val || !(Object.keys(val) || val).length;

export function first<T>(val: T | T[]): T {
  return Array.isArray(val) ? val[0] : val;
}

/**
 * convert a human-readable duration to ms
 * @param value
 */
export function toMilliseconds(value: string | number | undefined): number | null {
  if (isNumber(value)) return value;
  if (!value) return null;
  return duration(value);
}
