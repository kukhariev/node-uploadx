import fs from 'fs';
import { join } from 'path';
import * as utils from '../packages/core/src';
import { cleanup, testRoot } from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('fs utils', () => {
  const root = join(testRoot, 'fs-utils');
  const dir = join(root, '0', '1', '2');
  const filepath = join(dir, '3', 'file.ext');
  const filepath2 = join(dir, '3', 'fi  le.ext.META');

  beforeEach(async () => cleanup(root));

  afterEach(async () => cleanup(root));

  it('ensureDir(dir)', async () => {
    await utils.ensureDir(dir);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('ensureFile(file)', async () => {
    const size = await utils.ensureFile(filepath);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(size).toBe(0);
  });

  it('ensureFile(file, overwrite)', async () => {
    const size = await utils.ensureFile(filepath, true);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(size).toBe(0);
  });

  it('getFiles(full path)', async () => {
    await utils.ensureFile(filepath);
    await utils.ensureFile(`${filepath}.ext`);
    await utils.ensureFile(filepath2);
    await utils.ensureFile(`${filepath2}.ext`);
    await expect(utils.getFiles(filepath)).resolves.toHaveLength(2);
    await expect(utils.getFiles(filepath2)).resolves.toHaveLength(2);
  });

  it('getFiles(prefix)', async () => {
    await utils.ensureFile(filepath);
    await utils.ensureFile(filepath2);
    await expect(utils.getFiles(`${testRoot}/fs-`)).resolves.toHaveLength(2);
    await expect(utils.getFiles(`${testRoot}\\fs-`)).resolves.toHaveLength(2);
    await expect(utils.getFiles(`${testRoot}\\fs_`)).resolves.toHaveLength(0);
    await expect(utils.getFiles(`${testRoot}/fs_`)).resolves.toHaveLength(0);
  });

  it('getFiles(directory)', async () => {
    await utils.ensureFile(filepath);
    await utils.ensureFile(filepath2);
    await expect(utils.getFiles(testRoot)).resolves.toHaveLength(2);
  });

  it('getFiles(deep directory)', async () => {
    await utils.ensureFile(filepath);
    await utils.ensureFile(filepath2);
    await expect(utils.getFiles(dir)).resolves.toHaveLength(2);
  });

  it('getFiles(not existing)', async () => {
    await utils.ensureFile(filepath);
    await expect(utils.getFiles('not exist')).resolves.toHaveLength(0);
  });

  it('removeFile(path)', async () => {
    await utils.ensureFile(filepath);
    await utils.removeFile(filepath);
    expect(fs.existsSync(filepath)).toBe(false);
  });

  it('removeFile(not exist)', async () => {
    await utils.removeFile(filepath);
    expect(fs.existsSync(filepath)).toBe(false);
  });

  it('getWriteStream(path, 0)', async () => {
    await utils.ensureFile(filepath);
    const stream = utils.getWriteStream(filepath, 0);
    stream.close();
    expect(stream).toBeInstanceOf(fs.WriteStream);
  });
});
