import { expect } from 'chai';
import { tmpdir } from 'os';
import { DiskStorageOptions } from '../src/core';
import { DiskStorage } from '../src/disk-storage';
import { Socket } from 'net';
import * as http from 'http';
import { File } from '../src/core';

const DEST_ROOT = `${tmpdir()}/node-uploadx/`;
const options: DiskStorageOptions = {
  dest: (req, file) => `${DEST_ROOT}${file.userId}/${file.filename}`
};

describe('storage', function() {
  before(() => {
    const storage = new DiskStorage(options);
    storage.reset();
  });
  it('should return files', async function() {
    const storage = new DiskStorage(options);
    const files = await storage.read();
    expect(files).to.be.empty;
  });
  it('DiskStorage.create()', async () => {
    // Arguments

    const file1 = {
      userId: 'USER',
      filename: 'file.mp4',
      metadata: {
        name: 'file.mp4',
        mimeType: 'video/mp4',
        size: 2469036,
        lastModified: 1497077951924
      }
    };
    const req1 = new http.IncomingMessage(new Socket());
    req1.method = 'POST';
    req1.url = '/upload';
    req1.push(JSON.stringify(file1));
    req1.push(null);

    // Method call
    const storage = new DiskStorage(options);
    const result = await storage.create(req1, file1 as File);
    expect(result).to.be.not.undefined;
  });
});
