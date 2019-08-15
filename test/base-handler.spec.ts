import { expect } from 'chai';
import { BaseHandler } from '../src/core';
class Tester extends BaseHandler {}
describe('BaseHandler', () => {
  let tester: Tester;
  beforeEach(() => {
    tester = new Tester({});
  });
  describe('main', () => {
    it('new BaseHandler', () => {
      tester = new Tester({});
      expect(tester).to.be.instanceOf(BaseHandler);
    });
    it('props', () => {
      tester = new Tester({ allowMIME: ['video'] });
      expect(tester).to.be.haveOwnProperty('options');
    });
  });
  describe('cors', () => {
    it('single', () => {
      tester.cors.maxAge = 10000;
      expect(tester.cors).to.have.property('maxAge', 10000);
      expect(tester.cors).to.have.property('withCredentials', false);
    });

    it('object', () => {
      tester.cors = { maxAge: 100 } as any;
      expect(tester.cors).to.have.property('maxAge', 100);
      expect(tester.cors).to.have.property('withCredentials', false);
    });
  });
});
