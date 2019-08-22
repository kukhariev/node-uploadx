import { expect } from 'chai';
import * as fs from 'fs';
import * as http from 'http';
import { Socket } from 'net';
import { File } from '../src/core';
import { DiskStorage, DiskStorageOptions } from '../src/DiskStorage';
import { UPLOADS_DIR } from './server';

const FILE = ({
  userId: 'dst',
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
const FILEPATH = `${UPLOADS_DIR}/dst/file.mp4`;
let fileId = '';
describe('DiskStorage', function() {
  it('should create file', async function() {
    const req = new http.IncomingMessage(new Socket());
    req.method = 'POST';
    req.url = '/upload';
    req.push(JSON.stringify(FILE.metadata));
    req.push(null);
    const storage = new DiskStorage(OPTIONS);
    const { path, id } = await storage.create(req, FILE);
    fileId = id;
    expect(path).to.be.eq(FILEPATH);
    expect(fs.statSync(FILEPATH).size).to.be.eql(0);
  });
  it('should return user files', async function() {
    const storage = new DiskStorage(OPTIONS);
    const files = await storage.get({ id: fileId, userId: 'dst' });
    expect(files).to.be.not.empty;
  });
  it('should delete file', async function() {
    const storage = new DiskStorage(OPTIONS);
    const [file] = await storage.delete({ id: fileId, userId: 'dst' });
    expect(file.path).to.be.eq(FILEPATH);
  });
  it('should reset user storage', async function() {
    const storage = new DiskStorage(OPTIONS);
    storage.delete({ userId: 'dst' });
    const files = await storage.get({ userId: 'dst' });
    expect(files).to.be.empty;
  });
});
