import { expect } from 'chai';
import * as fs from 'fs';
import { join } from 'path';
import * as rimraf from 'rimraf';
import { DiskStorage, DiskStorageOptions, File } from '../src';
import { uploadDir, userId } from './server';
import { testfile } from './testfile';

describe('DiskStorage', function() {
  const options: DiskStorageOptions = {
    directory: uploadDir,
    filename: file => `${file.userId}/${file.filename}`
  };
  const name = join(userId, testfile.filename);
  const dstpath = join(uploadDir, name);
  const storage = new DiskStorage(options);

  before(function() {
    rimraf.sync(uploadDir);
  });

  after(function() {
    rimraf.sync(uploadDir);
  });

  it('should create file', async function() {
    const { path } = await storage.create({} as any, testfile);
    expect(path).to.be.eq(name);
    expect(fs.statSync(dstpath).size).to.be.eql(0);
  });

  it('should update metadata', async function() {
    const file = await storage.update(name, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).to.be.eq('newname.mp4');
    expect(file.metadata.mimeType).to.be.eq('video/mp4');
  });

  it('should return user files', async function() {
    const files = await storage.get(userId);
    expect(files).to.be.not.empty;
  });

  it('should delete file', async function() {
    const [file] = await storage.delete(name);
    expect(file.path).to.be.eq(name);
  });

  it('should reset user storage', async function() {
    await storage.delete(userId);
    const files = await storage.get(userId);
    expect(files).to.be.empty;
  });
});
