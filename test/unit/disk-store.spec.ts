import { expect } from 'chai';
import { tmpdir } from 'os';
import { DiskStorage } from '../../src/disk-storage';

const DEST_ROOT = `${tmpdir()}/node-uploadx/`;

const storage = new DiskStorage({
  dest: (req, file) => `${DEST_ROOT}${file.userId}/${file.filename}`
});
describe('storage', function() {
  before(() => {
    storage.reset();
  });
  it('should return files', async function() {
    const files = await storage.read();
    expect(files).to.be.empty;
  });
});
