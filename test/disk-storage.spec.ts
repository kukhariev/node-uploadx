import { join } from 'path';
import { DiskStorage, fsp } from '../src';
import { filename, metafile, storageOptions, testfile } from './fixtures';
import { FileWriteStream, RequestReadStream } from './fixtures/streams';

const directory = 'ds-test';

let writeStream: FileWriteStream;
jest.mock('../src/utils/fs', () => {
  return {
    ensureFile: async () => 0,
    getFiles: async () => [join(directory, filename), join(directory, metafile)],
    getWriteStream: () => writeStream,
    fsp: {
      stat: async () => ({ mtime: new Date() }),
      writeFile: async () => 0,
      readFile: async () => JSON.stringify(testfile),
      unlink: async () => null
    }
  };
});

describe('DiskStorage', () => {
  const options = { ...storageOptions, directory };
  let storage: DiskStorage;
  let mockReadable: RequestReadStream;

  beforeEach(() => {
    storage = new DiskStorage(options);
    return storage.create({} as any, testfile);
  });
  describe('initialisation', () => {
    it('should set defaults', () => {
      storage = new DiskStorage();
      expect(storage.isReady).toBe(true);
      expect(storage.directory).toBe('files');
    });
    it('should set directory', () => {
      storage = new DiskStorage(options);
      expect(storage.directory).toBe(directory);
    });
  });
  describe('.create()', () => {
    it('should set status', async () => {
      const { status, bytesWritten } = await storage.create({} as any, testfile);
      expect(bytesWritten).toBe(0);
      expect(status).toBe('created');
    });
    it('should reject on limits', async () => {
      try {
        await storage.create({} as any, {
          ...testfile,
          size: 54760833024
        });
      } catch (error) {
        expect(error).toHaveProperty('statusCode', 403);
      }
    });
  });
  describe('.update()', () => {
    it('should update metadata', async () => {
      const file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as any);
      expect(file.metadata.name).toBe('newname.mp4');
      expect(file.metadata.mimeType).toBe('video/mp4');
    });
  });
  describe('.write()', () => {
    beforeEach(() => {
      writeStream = new FileWriteStream();
      mockReadable = new RequestReadStream();
    });
    it('should set status and bytesWritten', async () => {
      mockReadable.__mockSend();
      const file = await storage.write({ ...testfile, start: 0, body: mockReadable });
      expect(file.status).toBe('part');
      expect(file.bytesWritten).toBe(5);
    });
    it('should set status and bytesWritten (resume)', async () => {
      const file = await storage.write({ ...testfile });
      expect(file.status).toBe('part');
      expect(file.bytesWritten).toBe(0);
    });

    it('should reject with 404', async () => {
      const mockReadFile = jest.spyOn(fsp, 'readFile');
      mockReadFile.mockRejectedValueOnce('notfound');
      const write = storage.write({ ...testfile });
      await expect(write).rejects.toHaveProperty('statusCode', 404);
    });

    it('should reject with 500', async () => {
      mockReadable.__mockPipeError(writeStream);
      const write = storage.write({ ...testfile, start: 0, body: mockReadable });
      await expect(write).rejects.toHaveProperty('statusCode', 500);
    });

    it('should close file and reset bytesWritten on abort', async () => {
      const close = jest.spyOn(writeStream, 'close');
      mockReadable.__mockAbort();
      const file = await storage.write({ ...testfile, start: 0, body: mockReadable });
      expect(+file.bytesWritten).toBeNaN();
      expect(close).toBeCalled();
    });
  });
  describe('.get()', () => {
    it('should return all user files', async () => {
      const files = await storage.get(testfile.userId);
      expect(files.length).toEqual(1);
      expect(files[0]).toMatchObject({ name: filename });
    });

    it('should return one file', async () => {
      const files = await storage.get(filename);
      expect(files.length).toEqual(1);
      expect(files[0]).toMatchObject({ name: filename });
    });
  });

  describe('.delete()', () => {
    it('should set status', async () => {
      const [deleted] = await storage.delete(filename);
      expect(deleted.name).toBe(filename);
      expect(deleted.status).toBe('deleted');
    });
    it('should ignore not fond', async () => {
      const mockReadFile = jest.spyOn(fsp, 'readFile');
      mockReadFile.mockRejectedValueOnce('notfound');
      const [deleted] = await storage.delete('notfound');
      expect(deleted.name).toBe('notfound');
      expect(deleted.status).toBeUndefined();
    });
  });
});
