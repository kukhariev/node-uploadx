import { expect } from 'chai';
import * as fs from 'fs';
import { normalize } from 'path';
import * as rimraf from 'rimraf';
import { DiskStorage, DiskStorageOptions, File } from '../src';
import { UPLOADS_DIR } from './server';

describe('DiskStorage', function() {
  const options: DiskStorageOptions = {
    directory: UPLOADS_DIR,
    filename: file => `${file.userId}/${file.filename}`
  };
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
  const FILEPATH = normalize(`${UPLOADS_DIR}/userId/file.mp4`);
  const FILENAME = `userId/file.mp4`;
  const storage = new DiskStorage(options);
  before(function() {
    rimraf.sync(UPLOADS_DIR);
  });
  after(function() {
    rimraf.sync(UPLOADS_DIR);
  });
  it('should create file', async function() {
    const { path } = await storage.create({} as any, FILE);
    expect(path).to.be.eq(FILENAME);
    expect(fs.statSync(FILEPATH).size).to.be.eql(0);
  });
  it('should update metadata', async function() {
    const file = await storage.update(FILENAME, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).to.be.eq('newname.mp4');
    expect(file.metadata.mimeType).to.be.eq('video/mp4');
  });
  it('should return user files', async function() {
    const files = await storage.get('userId');
    expect(files).to.be.not.empty;
  });
  it('should delete file', async function() {
    const [file] = await storage.delete(FILENAME);
    expect(file.path).to.be.eq(FILENAME);
  });
  it('should reset user storage', async function() {
    await storage.delete('userId');
    const files = await storage.get('userId');
    expect(files).to.be.empty;
  });
});
