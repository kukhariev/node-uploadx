import { DiskStorageOptions } from '../storages';

const CORE_ENV = {
  BASE_URL: 'BASE_URL',
  MAX_FILE_SIZE: 'MAX_FILE_SIZE',
  ALLOWED_MIME_TYPES: 'ALLOWED_MIME_TYPES',
  BASE_PATH: 'BASE_PATH',
  UPLOAD_DIR: 'UPLOAD_DIR',
  META_DIR: 'META_DIR',
  LOG_LEVEL: 'LOG_LEVEL'
} as const;

type EnvKey = keyof typeof CORE_ENV;

export const DEFAULT_PREFIX = '';

const getEnv = (prefix: string, key: EnvKey): string | undefined => {
  return process.env[prefix + CORE_ENV[key]];
};

export const commonFromEnv = (prefix = DEFAULT_PREFIX): Partial<DiskStorageOptions> => {
  const baseUrl = getEnv(prefix, 'BASE_URL');
  const maxFileSize = getEnv(prefix, 'MAX_FILE_SIZE');
  const basePath = getEnv(prefix, 'BASE_PATH');
  const allowedMimeTypes = getEnv(prefix, 'ALLOWED_MIME_TYPES')
    ?.split(',')
    .map(mime => mime.trim())
    .filter(Boolean);
  const logLevel = getEnv(prefix, 'LOG_LEVEL') as DiskStorageOptions['logLevel'];
  return {
    ...(baseUrl && { baseUrl }),
    ...(maxFileSize && { maxFileSize }),
    ...(basePath && { basePath }),
    ...(allowedMimeTypes?.length && { allowedMimeTypes }),
    ...(logLevel && { logLevel })
  };
};

export const fromEnv = (prefix = DEFAULT_PREFIX): Partial<DiskStorageOptions> => {
  const uploadDir = getEnv(prefix, 'UPLOAD_DIR');
  const metaDir = getEnv(prefix, 'META_DIR');
  return {
    ...commonFromEnv(prefix),
    ...(uploadDir && { uploadDir }),
    ...(metaDir && { metaDir })
  };
};
