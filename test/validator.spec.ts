import { Validator } from '@uploadx/core';

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
    await expect(validation.verify(obj)).rejects.toHaveProperty('uploadxError', 'VALIDATION_FIRST');
  });
  it('async isValid', async () => {
    const obj = { prop: 10 };
    validation.add({
      first: {
        isValid: p => Promise.resolve(p.prop > 20)
      }
    });
    await expect(validation.verify(obj)).rejects.toHaveProperty('uploadxError', 'VALIDATION_FIRST');
  });
  it('custom response', async () => {
    const obj = { prop: 10 };
    validation.add({
      first: {
        isValid: p => p.prop > 20,
        response: [400, 'error']
      }
    });
    expect(errorResponses).toHaveProperty('VALIDATION_FIRST');
    await expect(validation.verify(obj)).rejects.toHaveProperty('uploadxError', 'VALIDATION_FIRST');
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
