import { expect } from 'chai';
import { GCStorage } from '../src';

describe('GCStorage', function() {
  describe('constructor', () => {
    it('should create gcs-storage', function() {
      const gcs = new GCStorage();
      expect(gcs).to.be.instanceOf(GCStorage);
    });
  });
});
