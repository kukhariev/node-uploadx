import { expect } from 'chai';
import * as fs from 'fs';
import * as http from 'http';
import { Socket } from 'net';
import { tmpdir } from 'os';
import * as rimraf from 'rimraf';
import { File } from '../src/core';
import { DiskStorage, DiskStorageOptions } from '../src/DiskStorage';

const FILE = ({
  userId: 'userId',
  filename: 'file.mp4',
  metadata: {
    name: 'file.mp4',
    mimeType: 'video/mp4',
    size: 2469036,
    lastModified: 1497077951924
  }
} as unknown) as File;
const TEST_ROOT = tmpdir();
const OPTIONS: DiskStorageOptions = {
  dest: (req, file) => `${TEST_ROOT}/${file.userId}/${file.filename}`
};
const FILEPATH = '/tmp/userId/file.mp4'; // FIXME: Win
const DIR = '/tmp/userId/';
function cleanup() {
  rimraf.sync(DIR);
}

describe('DiskStorage', function() {
  before(function() {
    cleanup();
  });

  it('should create file', async function() {
    const req = new http.IncomingMessage(new Socket());
    req.method = 'POST';
    req.url = '/upload';
    req.push(JSON.stringify(FILE.metadata));
    req.push(null);
    const storage = new DiskStorage(OPTIONS);
    const result = await storage.create(req, FILE);
    expect(result.path).to.be.eq(FILEPATH);
    expect(fs.statSync(FILEPATH).size).to.be.eql(0);
  });
  it('should return files', async function() {
    const storage = new DiskStorage(OPTIONS);
    const files = await storage.read();
    expect(files)
      .to.be.an('array')
      .lengthOf(1);
  });
  it('should reset storage', async function() {
    const storage = new DiskStorage(OPTIONS);
    storage.reset();
    const files = await storage.read();
    expect(files).to.be.empty;
  });

  after(function() {
    cleanup();
  });
});
