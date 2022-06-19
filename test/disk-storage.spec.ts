import * as fs from 'fs';
import { vol } from 'memfs';
import { DiskStorage, fsp } from '../packages/core/src';
import {
  authRequest,
  FileWriteStream,
  RequestReadStream,
  storageOptions,
  testfile
} from './shared';

const directory = 'ds-test';

jest.mock('fs/promises');
jest.mock('fs');

describe('DiskStorage', () => {
  const options = { ...storageOptions, directory };
  let storage: DiskStorage;
  let readStream: RequestReadStream;
  const req = authRequest();
  const createFile = (): Promise<any> => {
    storage = new DiskStorage(options);
    return storage.create(req, testfile);
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

    it('should set status', async () => {
      const { status, bytesWritten } = await storage.create(req, testfile);
      expect(bytesWritten).toBe(0);
      expect(status).toBe('created');
    });

    it('should reject on limits', async () => {
      await expect(storage.create(req, { ...testfile, size: 6e10 })).rejects.toMatchObject({
        code: 'RequestEntityTooLarge',
        message: 'Request entity too large',
        name: 'ValidationError',
        statusCode: 413
      });
    });
  });

  describe('.update()', () => {
    beforeEach(createFile);

    it('should update metadata', async () => {
      const file = await storage.update(testfile, { metadata: { name: 'newname.mp4' } });
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
      const file = await storage.write({ ...testfile, start: 0, body: readStream });
      expect(file.bytesWritten).toBe(5);
    });

    it('should set status and bytesWritten (resume)', async () => {
      const file = await storage.write({ ...testfile });
      expect(file.bytesWritten).toBe(0);
    });

    it('should reject with 404', async () => {
      storage.cache.delete(testfile.id);
      const mockReadFile = jest.spyOn(fsp, 'readFile');
      mockReadFile.mockRejectedValueOnce(new Error('not found'));
      const write = storage.write({ ...testfile });
      await expect(write).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
    });

    it('should reject with 500', async () => {
      const fileWriteStream = new FileWriteStream();
      jest
        .spyOn(fs, 'createWriteStream')
        .mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);
      readStream.__mockPipeError(fileWriteStream);
      const write = storage.write({ ...testfile, start: 0, body: readStream });
      await expect(write).rejects.toHaveProperty('uploadxErrorCode', 'FileError');
    });

    it('should close file and reset bytesWritten on abort', async () => {
      const fileWriteStream = new FileWriteStream();
      jest
        .spyOn(fs, 'createWriteStream')
        .mockImplementationOnce(() => fileWriteStream as unknown as fs.WriteStream);
      const close = jest.spyOn(fileWriteStream, 'close');
      readStream.__mockAbort();
      const file = await storage.write({ ...testfile, start: 0, body: readStream });
      expect(+file.bytesWritten).toBeNaN();
      expect(close).toHaveBeenCalled();
    });

    it('should check chunk size', async () => {
      readStream.__mockSend();
      const write = storage.write({ ...testfile, start: testfile.size - 2, body: readStream });
      await expect(write).rejects.toHaveProperty('uploadxErrorCode', 'FileConflict');
    });
  });

  describe('.list()', () => {
    beforeEach(createFile);

    it('should return all user files', async () => {
      const { items } = await storage.list();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: testfile.id });
    });

    it('should return one file', async () => {
      const { items } = await storage.list(testfile.id);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: testfile.id });
    });
  });

  describe('.delete()', () => {
    beforeEach(createFile);

    it('should set status', async () => {
      const [deleted] = await storage.delete(testfile);
      expect(deleted.id).toBe(testfile.id);
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
