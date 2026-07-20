import { normalizeExpiration } from './expiration';
import { File } from './file';
import { BaseStorageOptions } from './storage';

export class ConfigHandler<T extends File = File> {
  static defaults: BaseStorageOptions<File> = {
    allowedMimeTypes: ['*/*'],
    maxFileSize: '5TB',
    namingFunction: ({ id }: File): string => id,
    useRelativeLocation: false,
    onComplete: (file: File) => file,
    onUpdate: (file: File) => file,
    onCreate: () => '',
    onDelete: () => '',
    onError: response => response,
    basePath: '',
    validation: {},
    maxMetadataSize: '4MB'
  };

  private static aliasMap: Record<string, string> = {
    allowMIME: 'allowedMimeTypes',
    filename: 'namingFunction',
    path: 'basePath',
    maxUploadSize: 'maxFileSize'
  };

  private _config = { ...ConfigHandler.defaults } as BaseStorageOptions<T>;

  set(config: Partial<BaseStorageOptions<T>> = {}): Required<BaseStorageOptions<T>> {
    const normalized = { ...config } as Record<string, unknown>;
    for (const [oldKey, newKey] of Object.entries(ConfigHandler.aliasMap)) {
      if (oldKey in normalized) {
        if (!(newKey in normalized)) {
          normalized[newKey] = normalized[oldKey];
        }
        delete normalized[oldKey];
      }
    }
    this._config = { ...this._config, ...normalized };
    const expiration = normalizeExpiration(this._config.expiration);
    this._config.expiration = expiration;
    return this._config as Required<BaseStorageOptions<T>>;
  }

  get(): BaseStorageOptions<T> {
    return this._config;
  }
}
