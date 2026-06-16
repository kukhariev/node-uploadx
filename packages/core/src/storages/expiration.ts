import { clamp, toMilliseconds } from '../utils';

/**
 * Age of the upload, after which it is considered expired and can be deleted
 */
export interface ExpirationOptions {
  maxAge: number | string;
  purgeInterval?: number | string;
  rolling?: boolean;
}

/** Shorthand type for expiration — a string/number is treated as `maxAge` */
export type ExpirationInput = string | number | ExpirationOptions;

/**
 * Computes a reasonable `purgeInterval` from `maxAge`.
 *
 * Formula: `clamp(maxAge / 12, 5min, 1h)`
 *
 * @example
 * ```ts
 * computePurgeInterval('1h')  // 300000 (5min)
 * computePurgeInterval('6h')  // 1800000 (30min)
 * computePurgeInterval('1d')  // 3600000 (1h)
 * computePurgeInterval('7d')  // 3600000 (1h)
 * ```
 */
export function computePurgeInterval(maxAge: string | number): number | undefined {
  const maxAgeMs = toMilliseconds(maxAge);
  if (!maxAgeMs) return undefined;
  const MIN_PURGE_MS = 5 * 60 * 1000;
  const MAX_PURGE_MS = 60 * 60 * 1000;
  return clamp(maxAgeMs / 12, MIN_PURGE_MS, MAX_PURGE_MS);
}

/**
 * Normalizes `ExpirationInput` to `ExpirationOptions`.
 *
 * - `string | number` → `{ maxAge, purgeInterval: auto }`
 * - `ExpirationOptions` → returned as-is
 * - `null | undefined` → `undefined`
 */
export function normalizeExpiration(expiration?: ExpirationInput): ExpirationOptions | undefined {
  if (!expiration) return undefined;
  if (typeof expiration === 'string' || typeof expiration === 'number') {
    return { maxAge: expiration, purgeInterval: computePurgeInterval(expiration), rolling: true };
  }
  // Validate object maxAge early (throws on invalid).
  toMilliseconds(expiration.maxAge);
  return { ...expiration };
}
