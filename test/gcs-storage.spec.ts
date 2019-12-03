import { expect } from 'chai';
import { GCStorage } from '../src';

describe('GCStorage', function() {
  before(function() {
    process.env.CI && this.skip();
  });

  describe('constructor', () => {
    it('should create gcs-storage', function() {
      const gcs = new GCStorage();
      expect(gcs).to.be.instanceOf(GCStorage);
    });
  });
});
