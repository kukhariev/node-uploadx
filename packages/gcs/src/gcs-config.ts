export class GCSConfig {
  static bucketName = 'node-uploadx';
  static uploadAPI = 'https://storage.googleapis.com/upload/storage/v1/b';
  static storageAPI = 'https://storage.googleapis.com/storage/v1/b';
  static authScopes = ['https://www.googleapis.com/auth/devstorage.full_control'];
}
