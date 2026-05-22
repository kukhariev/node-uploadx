import { commonFromEnv, DEFAULT_PREFIX, toBoolean } from '@uploadx/core';
import { S3StorageOptions } from './s3-storage';

const S3_ENV = {
  BUCKET: 'S3_BUCKET',
  ENDPOINT: 'S3_ENDPOINT',
  FORCE_PATH_STYLE: 'S3_FORCE_PATH_STYLE',
  KEYFILE: 'S3_KEYFILE',
  REGION: 'S3_REGION'
} as const;

type S3EnvKey = keyof typeof S3_ENV;

const getS3Env = (prefix: string, key: S3EnvKey): string | undefined => {
  return process.env[prefix + S3_ENV[key]];
};

export const fromEnv = (prefix = DEFAULT_PREFIX): Partial<S3StorageOptions> => {
  const bucket = getS3Env(prefix, 'BUCKET');
  const keyFile = getS3Env(prefix, 'KEYFILE');
  const region = getS3Env(prefix, 'REGION');
  const endpoint = getS3Env(prefix, 'ENDPOINT');
  const forcePathStyle = getS3Env(prefix, 'FORCE_PATH_STYLE');

  return {
    ...commonFromEnv(prefix),
    ...(bucket && { bucket }),
    ...(keyFile && { keyFile }),
    ...(region && { region }),
    ...(endpoint && { endpoint }),
    ...(forcePathStyle !== undefined && { forcePathStyle: toBoolean(forcePathStyle) })
  };
};
