import { Validator } from '../packages/core/src/utils/validator';

describe('Validator', () => {
  type TestObj = { prop: number };
  const errorResponses = {} as Record<string, any>;
  let validation: Validator<TestObj>;
  beforeEach(() => {
    validation = new Validator<TestObj>(errorResponses as any);
  });
  it('simple', async () => {
    const obj = { prop: 10 };
    validation.add({
      first: {
        isValid: p => p.prop > 20
      }
    });
    await expect(validation.verify(obj)).rejects.toHaveProperty(
      'uploadxErrorCode',
      'ValidationErrorFirst'
    );
  });
  it('async isValid', async () => {
    const obj = { prop: 10 };
    validation.add({
      first: {
        isValid: p => Promise.resolve(p.prop > 20)
      }
    });
    await expect(validation.verify(obj)).rejects.toHaveProperty(
      'uploadxErrorCode',
      'ValidationErrorFirst'
    );
  });
  it('custom response', async () => {
    const obj = { prop: 10 };
    validation.add({
      first: {
        isValid: p => p.prop > 20,
        response: [400, 'error']
      }
    });
    expect(errorResponses).toHaveProperty('ValidationErrorFirst');
    expect(errorResponses['ValidationErrorFirst']).toEqual([400, 'error']);
    await expect(validation.verify(obj)).rejects.toHaveProperty(
      'uploadxErrorCode',
      'ValidationErrorFirst'
    );
  });

  it('custom response 2', async () => {
    const obj = { prop: 10 };
    validation.add({
      second: {
        isValid: p => p.prop > 20,
        response: { statusCode: 400, body: 'error' }
      }
    });
    expect(errorResponses).toHaveProperty('ValidationErrorSecond');
    expect(errorResponses['ValidationErrorSecond']).toEqual([400, 'error', {}]);
    await expect(validation.verify(obj)).rejects.toHaveProperty(
      'uploadxErrorCode',
      'ValidationErrorSecond'
    );
  });

  it('throw missing isValid', () => {
    expect(() => {
      validation.add({
        first: {
          response: [400, 'error']
        }
      });
    }).toThrow();
  });
});
