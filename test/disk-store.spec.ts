process.env.NODE_ENV = 'testing';
import * as chai from 'chai';
import 'mocha';
const expect = chai.expect;
import { storage } from './server';

describe.skip('storage', function() {
  it('should return files array', async function() {
    const files = await storage.list();
    const filenames: string[] = [];
    files.forEach(e => {
      filenames.push(e.filename);
    });
    expect(filenames).to.have.members(['testfile.mp4']);
  });
});
