import { HttpError } from '../utils';
import { File } from './file';
import { BaseStorageOptions } from './storage';

export class ConfigHandler {
  static defaults: BaseStorageOptions<File> = {
    allowedMimeTypes: ['*/*'],
    maxFileSize: '5TB',
    namingFunction: ({ id }: File): string => id,
    useRelativeLocation: false,
    onComplete: (file: File) => file,
    onUpdate: (file: File) => file,
    onCreate: () => '',
    onDelete: () => '',
    onError: ({ statusCode, body, headers, cause, ...rest }: HttpError) => {
      const payload = (body || rest) as Record<string, unknown>;
      const { cause: _c, ...noDetails } = payload;
      return { statusCode, body: { error: noDetails }, headers };
    },
    basePath: '/files',
    validation: {},
    maxMetadataSize: '4MB'
  };

  private static aliasMap: Record<string, string> = {
    allowMIME: 'allowedMimeTypes',
    filename: 'namingFunction',
    path: 'basePath',
    maxUploadSize: 'maxFileSize'
  };

  private _config = this.set(ConfigHandler.defaults);

  set<T extends File>(config: BaseStorageOptions<T> = {}): Required<BaseStorageOptions<T>> {
    const normalized = { ...config } as Record<string, unknown>;
    for (const [oldKey, newKey] of Object.entries(ConfigHandler.aliasMap)) {
      if (oldKey in normalized) {
        if (!(newKey in normalized)) {
          normalized[newKey] = normalized[oldKey];
        }
        delete normalized[oldKey];
      }
    }
    return Object.assign(this._config ?? {}, normalized) as unknown as Required<
      BaseStorageOptions<T>
    >;
  }

  get<T extends File>(): Required<BaseStorageOptions<T>> {
    return this._config as unknown as Required<BaseStorageOptions<T>>;
  }
}
