export const S3_ENV = {
  BUCKET: 'S3_BUCKET',
  KEYFILE: 'S3_KEYFILE',
  REGION: 'S3_REGION',
  ENDPOINT: 'S3_ENDPOINT',
  FORCE_PATH_STYLE: 'S3_FORCE_PATH_STYLE',
  DEBUG: 'S3_DEBUG'
} as const;

export const getEnv = (key: keyof typeof S3_ENV): string | undefined => process.env[S3_ENV[key]];
