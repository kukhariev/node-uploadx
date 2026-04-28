export class GCSConfig {
  static bucketName = 'node-uploadx';

  // Default endpoints
  static defaultUploadAPI = 'https://storage.googleapis.com/upload/storage/v1/b';
  static defaultStorageAPI = 'https://storage.googleapis.com/storage/v1/b';

  // ENV overrides
  static envUploadAPI = process.env.GCS_UPLOAD_API;
  static envStorageAPI = process.env.GCS_STORAGE_API;

  static authScopes = ['https://www.googleapis.com/auth/devstorage.full_control'];

  private static _uploadAPI?: string;
  private static _storageAPI?: string;

  static get emulatorHost(): string | undefined {
    return process.env.STORAGE_EMULATOR_HOST;
  }

  static get isEmulator(): boolean {
    return !!this.emulatorHost;
  }

  static get uploadAPI(): string {
    if (!this._uploadAPI) {
      this._uploadAPI =
        this.envUploadAPI ||
        (this.isEmulator
          ? `http://${this.emulatorHost}/upload/storage/v1/b`
          : this.defaultUploadAPI);
    }
    return this._uploadAPI;
  }

  static get storageAPI(): string {
    if (!this._storageAPI) {
      this._storageAPI =
        this.envStorageAPI ||
        (this.isEmulator ? `http://${this.emulatorHost}/storage/v1/b` : this.defaultStorageAPI);
    }
    return this._storageAPI;
  }
}
