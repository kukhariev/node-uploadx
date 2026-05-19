const CORE_ENV = {
  UPLOADX_SECRET: 'UPLOADX_SECRET',
  BASE_URL: 'UPLOADX_BASE_URL'
} as const;

/**
 * Get environment variable by typed key
 */
export const getEnv = (key: keyof typeof CORE_ENV): string | undefined =>
  process.env[CORE_ENV[key]];
