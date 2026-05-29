import { ResponseTuple } from '../types';
import {
  ErrorMap,
  ErrorResponses,
  normalizeErrorResponse,
  UploadxError,
  UploadxErrorResponse
} from './errors';

export interface ValidatorConfig<T> {
  value?: any;
  isValid?: (t: T) => boolean | Promise<boolean>;
  response?: ResponseTuple | UploadxErrorResponse;
}

const capitalize = (s: string): string => s && s[0].toUpperCase() + s.slice(1);
export type Validation<T> = Record<string, ValidatorConfig<T>>;

export class Validator<T> {
  private _validators: Record<string, Required<ValidatorConfig<T>>> = {};

  constructor(
    private prefix = 'ValidationError',
    private errorResponses?: ErrorResponses
  ) {}

  add(config: Validation<T>): void {
    for (const [key, validator] of Object.entries(config)) {
      const code = `${this.prefix}${capitalize(key)}`;
      const v = { ...this._validators[code], ...validator };
      if (!v.response) {
        v.response = ErrorMap.UnprocessableEntity;
      }
      this._validators[code] = v;
      if (typeof this._validators[code].isValid !== 'function') {
        throw new Error('Validation config "isValid" is missing, or it is not a function!');
      }
      if (this.errorResponses) {
        const r = normalizeErrorResponse(v.response);
        r.code ??= code;
        if (!(r.code in ErrorMap)) {
          this.errorResponses[r.code] = r;
        }
      }
    }
  }

  async verify(t: T): Promise<void> {
    for (const [code, validator] of Object.entries(this._validators)) {
      if (!(await validator.isValid(t))) {
        const r = normalizeErrorResponse(validator.response);
        r.code ??= code;
        if (this.errorResponses && !(r.code in ErrorMap)) {
          this.errorResponses[r.code] = r;
        }
        return Promise.reject(new UploadxError(r.code, r.message));
      }
    }
  }
}
