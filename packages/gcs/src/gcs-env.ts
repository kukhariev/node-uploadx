import { commonFromEnv, DEFAULT_PREFIX } from '@uploadx/core';
import { GCStorageOptions } from './gcs-storage';

const GCS_ENV = { BUCKET: 'GCS_BUCKET', KEYFILE: 'GCS_KEYFILE' } as const;

type GCSEnvKey = keyof typeof GCS_ENV;

const getGCSEnv = (prefix: string, key: GCSEnvKey): string | undefined => {
  return process.env[prefix + GCS_ENV[key]];
};

export const fromEnv = (prefix = DEFAULT_PREFIX): Partial<GCStorageOptions> => {
  const bucket = getGCSEnv(prefix, 'BUCKET');
  const keyFile = getGCSEnv(prefix, 'KEYFILE');
  return {
    ...commonFromEnv(prefix),
    ...(bucket && { bucket }),
    ...(keyFile && { keyFile })
  };
};
