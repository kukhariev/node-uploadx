import { Validator } from '../packages/core/src';

describe('Validator', () => {
  type TestObj = { prop: number };
  let validation: Validator<TestObj>;
  let responses: Record<string, any>;

  beforeEach(() => {
    responses = {};
    validation = new Validator<TestObj>(undefined, responses);
  });

  it('simple', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        isValid: p => p.prop > 20
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      uploadxErrorCode: 'UnprocessableEntity',
      name: 'UploadxError'
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
      uploadxErrorCode: 'UnprocessableEntity',
      name: 'UploadxError'
    });
  });

  it('custom response', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        isValid: p => p.prop > 20,
        response: { code: 'ValidationErrorCustom', statusCode: 400, message: 'error' }
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      uploadxErrorCode: 'ValidationErrorCustom',
      name: 'UploadxError'
    });
  });

  it('custom response 2', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        isValid(p) {
          return p.prop > 20;
        },
        response: { statusCode: 400, message: 'error' }
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      uploadxErrorCode: 'ValidationErrorCustom',
      name: 'UploadxError'
    });
  });

  it('tuple with body object', async () => {
    const obj = { prop: 10 };
    validation.add({
      custom: {
        isValid: p => p.prop > 20,
        response: [415, { message: 'video only' }]
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      uploadxErrorCode: 'ValidationErrorCustom',
      name: 'UploadxError'
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
            message: `prop: ${p.prop} less value: ${this.value as number}`
          };
          return p.prop > this.value;
        }
      }
    });
    await expect(validation.verify(obj)).rejects.toMatchObject({
      uploadxErrorCode: 'ValidationErrorCustom',
      name: 'UploadxError'
    });
  });

  it('throw missing isValid', () => {
    expect(() => {
      validation.add({
        custom: {
          response: { code: 'test', statusCode: 400, message: 'error' }
        }
      });
    }).toThrow();
  });
});
