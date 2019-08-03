process.env.NODE_ENV = 'testing';
import * as chai from 'chai';
import 'mocha';
const expect = chai.expect;

describe('storage', function() {
  let storage;
  before(() => {
    storage = require('./server').storage;
  });

  it('should return files', async function() {
    const files = await storage.read();
    expect(files).to.be.empty;
  });
});
