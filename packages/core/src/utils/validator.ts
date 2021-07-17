import { ErrorMap, ErrorResponses, fail, HttpError } from './errors';
import { responseToTuple, ResponseTuple } from './http';

export interface ValidatorConfig<T> {
  value?: any;
  isValid?: (t: T) => boolean | Promise<boolean>;
  response?: ResponseTuple<any> | HttpError<any>;
}
const capitalize = (s: string): string => s && s[0].toUpperCase() + s.slice(1);
export type Validation<T> = Record<string, ValidatorConfig<T>>;

export class Validator<T> {
  private _validators: Record<string, ValidatorConfig<T>> = {};

  constructor(public errorResponses: ErrorResponses, private prefix = 'ValidationError') {}

  add(config: Validation<T>): void {
    for (const [key, validator] of Object.entries(config)) {
      const code = `${this.prefix}${capitalize(key)}`;
      validator.response &&
        (this.errorResponses[code] = responseToTuple(validator.response) as ErrorResponses[string]);
      this._validators[code] = { ...this._validators[code], ...validator };
      if (typeof this._validators[code].isValid !== 'function') {
        throw new Error('Validation config "isValid" is missing or it is not a function!');
      }
      if (!this._validators[code].response) {
        this._validators[code].response = this.errorResponses[code] = ErrorMap.UnprocessableEntity;
      }
    }
  }

  async verify(t: T): Promise<void | never> {
    for (const [errorCode, validator] of Object.entries(this._validators)) {
      if (validator.isValid && !(await validator.isValid(t))) {
        return fail(errorCode);
      }
    }
  }
}
