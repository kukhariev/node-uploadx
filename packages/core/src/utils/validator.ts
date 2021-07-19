import { ErrorMap, HttpError } from './errors';
import { ResponseTuple, tupleToResponse } from './http';

export interface ValidatorConfig<T> {
  value?: any;
  isValid?: (t: T) => boolean | Promise<boolean>;
  response?: ResponseTuple<any> | HttpError<any>;
}
const capitalize = (s: string): string => s && s[0].toUpperCase() + s.slice(1);
export type Validation<T> = Record<string, ValidatorConfig<T>>;

export interface ValidationError extends HttpError {
  name: 'ValidationError';
}

export function isValidationError(error: unknown): error is ValidationError {
  return (error as ValidationError).name === 'ValidationError';
}
export class Validator<T> {
  private _validators: Record<string, Required<ValidatorConfig<T>>> = {};

  constructor(private prefix = 'ValidationError') {}

  add(config: Validation<T>): void {
    for (const [key, validator] of Object.entries(config)) {
      const code = `${this.prefix}${capitalize(key)}`;
      this._validators[code] = { ...this._validators[code], ...validator };
      if (typeof this._validators[code].isValid !== 'function') {
        throw new Error('Validation config "isValid" is missing or it is not a function!');
      }
    }
  }

  async verify(t: T): Promise<void | never> {
    for (const [code, validator] of Object.entries(this._validators)) {
      if (!(await validator.isValid(t))) {
        return Promise.reject({
          name: 'ValidationError',
          code,
          ...tupleToResponse(validator.response || ErrorMap.UnprocessableEntity)
        });
      }
    }
  }
}
