export * from '@uploadx/core';

export { fromEnv as s3FromEnv, S3MetaStorage, S3Storage } from '@uploadx/s3';
export type { S3File, S3MetaStorageOptions, S3StorageOptions } from '@uploadx/s3';
export type { AWSError } from '@uploadx/s3';

export { GCSConfig, fromEnv as gcsFromEnv, GCSMetaStorage, GCStorage } from '@uploadx/gcs';
export type { GCSFile, GCSMetaStorageOptions, GCStorageOptions } from '@uploadx/gcs';
