import { createHash, randomBytes } from 'crypto';

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
