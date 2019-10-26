import { expect } from 'chai';
import { Request } from 'express';
import * as fs from 'fs';
import * as httpMocks from 'node-mocks-http';
import { normalize } from 'path';
import { File } from '../src';
import { DiskStorage, DiskStorageOptions } from '../src';
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
    dest: (req, file) => `${UPLOADS_DIR}/${file.userId}/${file.filename}`
  };
  const FILEPATH = normalize(`${UPLOADS_DIR}/userId/file.mp4`);
  it('should create file', async function() {
    mockReq = httpMocks.createRequest({
      url: 'http://example.com/upload',
      method: 'POST',
      body: FILE.metadata
    });
    const storage = new DiskStorage(OPTIONS);
    const { path } = await storage.create(mockReq, FILE);
    expect(path).to.be.eq(FILEPATH);
    expect(fs.statSync(FILEPATH).size).to.be.eql(0);
  });
  it('should return user files', async function() {
    const storage = new DiskStorage(OPTIONS);
    const files = await storage.get({ id: 'fileId', userId: 'userId' });
    expect(files).to.be.not.empty;
  });
  it('should delete file', async function() {
    const storage = new DiskStorage(OPTIONS);
    const [file] = await storage.delete({ id: 'fileId', userId: 'userId' });
    expect(file.path).to.be.eq(FILEPATH);
  });
  it('should reset user storage', async function() {
    const storage = new DiskStorage(OPTIONS);
    storage.delete({ userId: 'userId' });
    const files = await storage.get({ userId: 'userId' });
    expect(files).to.be.empty;
  });
});
