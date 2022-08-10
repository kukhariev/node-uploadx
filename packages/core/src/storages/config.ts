import { File } from './file';
import { BaseStorageOptions } from './storage';

class ConfigHandler {
  static defaults = {
    allowMIME: ['*/*'],
    maxUploadSize: '5TB',
    filename: ({ id }: File): string => id,
    useRelativeLocation: false,
    onComplete: () => null,
    path: '/files',
    validation: {},
    maxMetadataSize: '4MB'
  };

  private _config = this.set(ConfigHandler.defaults);

  set<T extends File>(config: BaseStorageOptions<T> = {}): Required<BaseStorageOptions<T>> {
    return Object.assign(this._config ?? {}, config);
  }

  get<T extends File>(): Required<BaseStorageOptions<T>> {
    return this._config as unknown as Required<BaseStorageOptions<T>>;
  }
}

export const configHandler = new ConfigHandler();
