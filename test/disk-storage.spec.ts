import { expect } from 'chai';
import { Request } from 'express';
import * as fs from 'fs';
import * as httpMocks from 'node-mocks-http';
import { normalize } from 'path';
import * as rimraf from 'rimraf';
import { DiskStorage, DiskStorageOptions, File } from '../src';
import { UPLOADS_DIR } from './server';

const FILE = ({
  id: 'fileId',
  userId: 'userId',
  filename: 'file.mp4',
  size: 2469036,
  mimeType: 'video/mp4',
  metadata: {
    name: 'file.mp4',
    mimeType: 'video/mp4',
    size: 2469036,
    lastModified: 1497077951924
  }
} as unknown) as File;

describe('DiskStorage', function() {
  let mockReq: Request;
  const OPTIONS: DiskStorageOptions = {
    directory: UPLOADS_DIR,
    filename: file => `${file.userId}/${file.filename}`
  };
  const FILEPATH = normalize(`${UPLOADS_DIR}/userId/file.mp4`);
  const FILENAME = `userId/file.mp4`;
  before(function() {
    rimraf.sync(UPLOADS_DIR);
  });
  after(function() {
    rimraf.sync(UPLOADS_DIR);
  });
  it('should create file', async function() {
    mockReq = httpMocks.createRequest({
      url: 'http://example.com/upload',
      method: 'POST',
      body: FILE.metadata
    });
    const storage = new DiskStorage(OPTIONS);
    const { path } = await storage.create(mockReq, FILE);
    expect(path).to.be.eq(FILENAME);
    expect(fs.statSync(FILEPATH).size).to.be.eql(0);
  });
  it('should return user files', async function() {
    const storage = new DiskStorage(OPTIONS);
    const files = await storage.get('userId');
    expect(files).to.be.not.empty;
  });
  it('should delete file', async function() {
    const storage = new DiskStorage(OPTIONS);
    const [file] = await storage.delete(FILENAME);
    expect(file.path).to.be.eq(FILENAME);
  });
  it('should reset user storage', async function() {
    const storage = new DiskStorage(OPTIONS);
    await storage.delete('userId');
    const files = await storage.get('userId');
    expect(files).to.be.empty;
  });
});
