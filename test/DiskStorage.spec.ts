import { expect } from 'chai';
import * as fs from 'fs';
import * as http from 'http';
import { Socket } from 'net';
import { File } from '../src/core';
import { DiskStorage, DiskStorageOptions } from '../src/DiskStorage';
import { UPLOADS_DIR } from './server';

const FILE = ({
  id: 'fileId',
  userId: 'userId',
  filename: 'file.mp4',
  metadata: {
    name: 'file.mp4',
    mimeType: 'video/mp4',
    size: 2469036,
    lastModified: 1497077951924
  }
} as unknown) as File;

const OPTIONS: DiskStorageOptions = {
  dest: (req, file) => `${UPLOADS_DIR}/${file.userId}/${file.filename}`
};
const FILEPATH = `${UPLOADS_DIR}/userId/file.mp4`;
describe('DiskStorage', function() {
  it('should create file', async function() {
    const req = new http.IncomingMessage(new Socket());
    req.method = 'POST';
    req.url = '/upload';
    req.push(JSON.stringify(FILE.metadata));
    req.push(null);
    const storage = new DiskStorage(OPTIONS);
    const { path } = await storage.create(req, FILE);
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
