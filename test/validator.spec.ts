import { Validator } from '../packages/core/src/utils/validator';

describe('Validator', () => {
  type TestObj = { prop: number };
  let validation: Validator<TestObj>;

  beforeEach(() => {
    validation = new Validator<TestObj>();
  });

  it('simple', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        isValid: p => p.prop > 20
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      code: 'UnprocessableEntity',
      message: 'Validation failed',
      name: 'ValidationError',
      statusCode: 422
    });
  });

  it('async isValid', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        isValid: p => Promise.resolve(p.prop > 20)
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      code: 'UnprocessableEntity',
      message: 'Validation failed',
      name: 'ValidationError',
      statusCode: 422
    });
  });

  it('custom response', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        isValid: p => p.prop > 20,
        response: [400, 'error']
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      body: 'error',
      code: 'ValidationErrorCustom',
      headers: undefined,
      name: 'ValidationError',
      statusCode: 400
    });
  });

  it('custom response 2', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        isValid(p) {
          return p.prop > 20;
        },
        response: { statusCode: 400, body: 'error' }
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      body: 'error',
      code: 'ValidationErrorCustom',
      // headers: undefined,
      name: 'ValidationError',
      statusCode: 400
    });
  });

  it('custom response 3', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        value: 20,
        isValid(p) {
          this.response = {
            statusCode: 400,
            body: `prop: ${p.prop} less value: ${this.value as number}`
          };
          return p.prop > this.value;
        }
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      body: 'prop: 10 less value: 20',
      code: 'ValidationErrorCustom',
      //FIXME:  headers: undefined,
      name: 'ValidationError',
      statusCode: 400
    });
  });

  it('throw missing isValid', () => {
    expect(() => {
      validation.add({
        custom: {
          response: [400, 'error']
        }
      });
    }).toThrow();
  });
});
