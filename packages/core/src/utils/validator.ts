import { ErrorResponses, ERROR_RESPONSES, fail, ResponseTuple } from './errors';

export interface ValidatorConfig<T> {
  value?: any;
  isValid?: (t: T) => boolean | Promise<boolean>;
  response?: ResponseTuple<any>;
}

export type Validation<T> = Record<string, ValidatorConfig<T>>;

export class Validator<T> {
  private _validators: Record<string, ValidatorConfig<T>> = {};

  constructor(public errorResponses: ErrorResponses, private prefix = 'ValidationError') {}

  add(config: Validation<T>): void {
    for (const [key, validator] of Object.entries(config)) {
      const code = `${this.prefix}${key}`;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      validator.response && (this.errorResponses[code] = validator.response);
      const entry = (this._validators[code] = { ...this._validators[code], ...validator });
      if (typeof entry.isValid !== 'function') {
        throw new Error('Validation config "isValid" is missing or it is not a function!');
      }
      if (!entry.response) {
        this._validators[code].response = ERROR_RESPONSES.UnprocessableEntity;
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
