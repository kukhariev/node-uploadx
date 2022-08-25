import { HttpError, logger } from '../utils';
import { File } from './file';
import { BaseStorageOptions } from './storage';

export class ConfigHandler {
  static defaults = {
    allowMIME: ['*/*'],
    maxUploadSize: '5TB',
    filename: ({ id }: File): string => id,
    useRelativeLocation: false,
    onComplete: () => null,
    onError: ({ statusCode, body, headers }: HttpError) => {
      return { statusCode, body: { error: body }, headers };
    },
    path: '/files',
    validation: {},
    maxMetadataSize: '4MB',
    logger: logger
  };

  private _config = this.set(ConfigHandler.defaults);

  set<T extends File>(config: BaseStorageOptions<T> = {}): Required<BaseStorageOptions<T>> {
    return Object.assign(this._config ?? {}, config);
  }

  get<T extends File>(): Required<BaseStorageOptions<T>> {
    return this._config as unknown as Required<BaseStorageOptions<T>>;
  }
}
