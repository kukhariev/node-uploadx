process.env.NODE_ENV = 'testing';
import * as chai from 'chai';
import 'mocha';
const expect = chai.expect;

describe.skip('storage', function() {
  let storage;
  before(() => {
    storage = require('./server').storage;
  });

  it('should return files array', async function() {
    const files = await storage.list();
    const filenames: string[] = [];
    files.forEach(e => {
      filenames.push(e.filename);
    });
    expect(filenames).to.have.members(['testfile.mp4']);
  });
});
