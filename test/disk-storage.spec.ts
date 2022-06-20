import * as fs from 'fs';
import { vol } from 'memfs';
import { DiskStorage, fsp } from '../packages/core/src';
import {
  authRequest,
  FileWriteStream,
  metafile,
  RequestReadStream,
  storageOptions
} from './shared';

const directory = 'ds-test';

jest.mock('fs/promises');
jest.mock('fs');

describe('DiskStorage', () => {
  jest.useFakeTimers({ doNotFake: ['setTimeout'] }).setSystemTime(new Date('2022-02-02'));
  const options = { ...storageOptions, directory };
  let storage: DiskStorage;
  let readStream: RequestReadStream;
  const req = authRequest();
  const createFile = (): Promise<any> => {
    storage = new DiskStorage(options);
    return storage.create(req, metafile);
  };

  describe('initialization', () => {
    it('should set defaults', () => {
      storage = new DiskStorage();
      expect(storage.directory).toBe('files');
    });

    it('should set directory', () => {
      storage = new DiskStorage(options);
      expect(storage.directory).toBe(directory);
    });
  });

  describe('.create()', () => {
    beforeEach(() => (storage = new DiskStorage(options)));

    it('should set status and bytesWritten', async () => {
      const diskFile = await storage.create(req, metafile);
      expect(diskFile).toMatchSnapshot();
    });

    it('should reject on limits', async () => {
      await expect(storage.create(req, { ...metafile, size: 6e10 })).rejects.toMatchSnapshot();
    });
  });

  describe('.update()', () => {
    beforeEach(createFile);

    it('should update metadata', async () => {
      const file = await storage.update(metafile, { metadata: { name: 'newname.mp4' } });
      expect(file.metadata.name).toBe('newname.mp4');
      expect(file.metadata.mimeType).toBe('video/mp4');
    });
  });

  describe('.write()', () => {
    beforeEach(() => {
      vol.reset();
      readStream = new RequestReadStream();
      return createFile();
    });

    it('should set status and bytesWritten', async () => {
      readStream.__mockSend();
      const file = await storage.write({ ...metafile, start: 0, body: readStream });
      expect(file.bytesWritten).toBe(5);
    });

    it('should set status and bytesWritten (resume)', async () => {
      const file = await storage.write({ ...metafile });
      expect(file.bytesWritten).toBe(0);
    });

    it('should reject if file not found', async () => {
      storage.cache.delete(metafile.id);
      const mockReadFile = jest.spyOn(fsp, 'readFile');
      mockReadFile.mockRejectedValueOnce(new Error('not found'));
      const write = storage.write({ ...metafile });
      await expect(write).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
    });

    it('should reject on fs errors', async () => {
      const fileWriteStream = new FileWriteStream();
      jest
        .spyOn(fs, 'createWriteStream')
        .mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);
      readStream.__mockPipeError(fileWriteStream);
      const write = storage.write({ ...metafile, start: 0, body: readStream });
      await expect(write).rejects.toHaveProperty('uploadxErrorCode', 'FileError');
    });

    it('should close file and reset bytesWritten on abort', async () => {
      const fileWriteStream = new FileWriteStream();
      jest
        .spyOn(fs, 'createWriteStream')
        .mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);
      const close = jest.spyOn(fileWriteStream, 'close');
      readStream.__mockAbort();
      const file = await storage.write({ ...metafile, start: 0, body: readStream });
      expect(+file.bytesWritten).toBeNaN();
      expect(close).toHaveBeenCalled();
    });

    it('should reject on invalid range', async () => {
      readStream.__mockSend();
      const write = storage.write({ ...metafile, start: metafile.size - 2, body: readStream });
      await expect(write).rejects.toHaveProperty('uploadxErrorCode', 'FileConflict');
    });
  });

  describe('.list()', () => {
    beforeEach(createFile);

    it('should return all user files', async () => {
      const { items } = await storage.list();
      expect(items).toHaveLength(1);
      expect(items).toMatchSnapshot();
    });

    it('should return one file', async () => {
      const { items } = await storage.list(metafile.id);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: metafile.id });
    });
  });

  describe('.delete()', () => {
    beforeEach(createFile);

    it('should set status', async () => {
      const [deleted] = await storage.delete(metafile);
      expect(deleted.id).toBe(metafile.id);
      expect(deleted.status).toBe('deleted');
    });

    it('should ignore not found', async () => {
      const mockReadFile = jest.spyOn(fsp, 'readFile');
      mockReadFile.mockRejectedValueOnce('notfound');
      const [deleted] = await storage.delete({ id: 'notfound' });
      expect(deleted.id).toBe('notfound');
      expect(deleted.status).toBeUndefined();
    });
  });

  describe('.purge()', () => {
    beforeEach(createFile);

    it('should delete file', async () => {
      jest.useFakeTimers();
      jest.advanceTimersByTime(500);
      const list = await storage.purge(5);
      expect(list.items).toHaveLength(1);
      jest.useRealTimers();
    });
  });
});
