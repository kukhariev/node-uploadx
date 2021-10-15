import { posix } from 'path';
import { DiskStorage, fsp } from '../packages/core/src';
import {
  filename,
  FileWriteStream,
  metafilename,
  RequestReadStream,
  storageOptions,
  testfile
} from './shared';

const directory = 'ds-test';
let fileWriteStream: FileWriteStream;

jest.mock('../packages/core/src/utils/fs', () => {
  const timestamp = Date.now() - 10000;
  return {
    ensureFile: async () => 0,
    accessCheck: (dir: string, cb: () => void) => cb(),
    getFiles: async () => [posix.join(directory, filename), posix.join(directory, metafilename)],
    getWriteStream: () => fileWriteStream,
    fsp: {
      stat: async () => ({
        mtime: timestamp,
        ctime: timestamp
      }),
      writeFile: async () => 0,
      readFile: async () => JSON.stringify(testfile),
      unlink: async () => null
    }
  };
});

describe('DiskStorage', () => {
  const options = { ...storageOptions, directory };
  let storage: DiskStorage;
  let readStream: RequestReadStream;
  const createFile = (): Promise<any> => {
    storage = new DiskStorage(options);
    return storage.create({} as any, testfile);
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
      const { status, bytesWritten } = await storage.create({} as any, testfile);
      expect(bytesWritten).toBe(0);
      expect(status).toBe('created');
    });

    it('should reject on limits', async () => {
      await expect(storage.create({} as any, { ...testfile, size: 6e10 })).rejects.toMatchObject({
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
      const file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as any);
      expect(file.metadata.name).toBe('newname.mp4');
      expect(file.metadata.mimeType).toBe('video/mp4');
    });
  });

  describe('.write()', () => {
    beforeEach(() => {
      fileWriteStream = new FileWriteStream();
      readStream = new RequestReadStream();
      return createFile();
    });

    it('should set status and bytesWritten', async () => {
      readStream.__mockSend();
      const file = await storage.write({ ...testfile, start: 0, body: readStream });
      expect(file.status).toBe('part');
      expect(file.bytesWritten).toBe(5);
    });

    it('should set status and bytesWritten (resume)', async () => {
      const file = await storage.write({ ...testfile });
      expect(file.status).toBe('part');
      expect(file.bytesWritten).toBe(0);
    });

    it('should reject with 404', async () => {
      storage.cache.delete(testfile.name);
      const mockReadFile = jest.spyOn(fsp, 'readFile');
      mockReadFile.mockRejectedValueOnce(new Error('not found'));
      const write = storage.write({ ...testfile });
      await expect(write).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
    });

    it('should reject with 500', async () => {
      readStream.__mockPipeError(fileWriteStream);
      const write = storage.write({ ...testfile, start: 0, body: readStream });
      await expect(write).rejects.toHaveProperty('uploadxErrorCode', 'FileError');
    });

    it('should close file and reset bytesWritten on abort', async () => {
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
      const { items } = await storage.list(testfile.userId);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ name: filename });
    });

    it('should return one file', async () => {
      const { items } = await storage.list(filename);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ name: filename });
    });
  });

  describe('.delete()', () => {
    beforeEach(createFile);

    it('should set status', async () => {
      const [deleted] = await storage.delete(filename);
      expect(deleted.name).toBe(filename);
      expect(deleted.status).toBe('deleted');
    });

    it('should ignore not found', async () => {
      const mockReadFile = jest.spyOn(fsp, 'readFile');
      mockReadFile.mockRejectedValueOnce('notfound');
      const [deleted] = await storage.delete('notfound');
      expect(deleted.name).toBe('notfound');
      expect(deleted.status).toBeUndefined();
    });
  });

  describe('.purge()', () => {
    beforeEach(createFile);

    it('should delete file', async () => {
      const list = await storage.purge(5);
      expect(list.items).toHaveLength(1);
    });
  });
});
