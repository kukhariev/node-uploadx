import { TestStorage } from './shared';

describe('expiration', () => {
  it('should normalize string shorthand to ExpirationOptions', () => {
    const s = new TestStorage({ expiration: '6h' });
    expect(s.config.expiration).toBeDefined();
    expect(s.config.expiration?.maxAge).toBe('6h');
    expect(s.config.expiration?.purgeInterval).toBe(1800000); // 30min (6h/12)
  });

  it('should normalize number shorthand to ExpirationOptions', () => {
    const s = new TestStorage({ expiration: 3600000 });
    expect(s.config.expiration).toBeDefined();
    expect(s.config.expiration?.maxAge).toBe(3600000);
    expect(s.config.expiration?.purgeInterval).toBe(300000); // 5min (1h/12 clamped)
  });

  it('should keep ExpirationOptions object as-is', () => {
    const s = new TestStorage({ expiration: { maxAge: '1h', rolling: true } });
    expect(s.config.expiration).toBeDefined();
    expect(s.config.expiration?.maxAge).toBe('1h');
    expect(s.config.expiration?.rolling).toBe(true);
    // purgeInterval should NOT be added for object syntax without it
    expect(s.config.expiration?.purgeInterval).toBeUndefined();
  });

  it('should preserve explicit purgeInterval in object syntax', () => {
    const s = new TestStorage({ expiration: { maxAge: '1h', purgeInterval: '15min' } });
    expect(s.config.expiration).toBeDefined();
    expect(s.config.expiration?.maxAge).toBe('1h');
    // purgeInterval can be string or number - it will be converted to ms when used
    expect(s.config.expiration?.purgeInterval).toBe('15min');
  });

  it('should preserve explicit numeric purgeInterval', () => {
    const s = new TestStorage({ expiration: { maxAge: '6h', purgeInterval: 600000 } });
    expect(s.config.expiration).toBeDefined();
    expect(s.config.expiration?.maxAge).toBe('6h');
    expect(s.config.expiration?.purgeInterval).toBe(600000); // explicit 10min
  });

  it('should compute purgeInterval for 7d as 1h', () => {
    const s = new TestStorage({ expiration: '7d' });
    expect(s.config.expiration?.purgeInterval).toBe(3600000); // 1h
  });

  it('should compute purgeInterval for 10min as 5min (clamp)', () => {
    const s = new TestStorage({ expiration: '10min' });
    expect(s.config.expiration?.purgeInterval).toBe(300000); // 5min
  });

  it('should be undefined when expiration is not set', () => {
    const s = new TestStorage();
    expect(s.config.expiration).toBeUndefined();
  });

  it('should throw when shorthand maxAge is invalid', () => {
    expect(() => new TestStorage({ expiration: 'abc' })).toThrow('Invalid duration format');
  });

  it('should throw when purgeInterval is invalid', () => {
    expect(() => new TestStorage({ expiration: { maxAge: '1h', purgeInterval: 'abc' } })).toThrow(
      'Invalid duration format'
    );
  });

  it('should throw when object maxAge is invalid', () => {
    expect(() => new TestStorage({ expiration: { maxAge: 'abc' } })).toThrow(
      'Invalid duration format'
    );
  });
});
