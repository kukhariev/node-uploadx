import fs from 'fs';
import { vol } from 'memfs';
import { Readable } from 'node:stream';
import { DiskStorage, fsp } from '../packages/core/src';
import { FilePart } from '../packages/core/src/storages/file';
import {
  authRequest,
  deepClone,
  FileWriteStream,
  metafile,
  RequestReadStream,
  storageOptions
} from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('DiskStorage', () => {
  jest.useFakeTimers({ doNotFake: ['setTimeout'] }).setSystemTime(new Date('2022-02-02'));
  const directory = 'ds-test';
  const options = { ...storageOptions, directory };
  let storage: DiskStorage;
  let readStream: RequestReadStream;
  const req = authRequest();
  const createFile = (): Promise<any> => {
    storage = new DiskStorage(options);
    return storage.create(req, deepClone(metafile));
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
      expect(file.status).toBe('part');
      expect(file.bytesWritten).toBe(5);
    });

    it('should return bytesWritten (resume)', async () => {
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

describe('DiskStorage - Parallel Upload Test', () => {
  const TEST_DIR = 'test-uploads';
  const fileName = 'parallel-test.bin';
  const fileSize = 50 * 1024 * 1024; // 50 MB
  const chunkCount = 5;
  const chunkSize = fileSize / chunkCount;

  const chunks: FilePart[] = [];

  function generatePatternBuffer(size: number): Buffer {
    const buffer = Buffer.alloc(size);
    const wordsCount = Math.floor(size / 4);
    for (let i = 0; i < wordsCount; i++) {
      buffer.writeUInt32LE(i, i * 4);
    }
    return buffer;
  }

  let originalData: Buffer;
  let storage: DiskStorage;
  let fileId: string;

  beforeAll(async () => {
    vol.reset();
    jest.useRealTimers();

    storage = new DiskStorage({ directory: TEST_DIR });

    const fileInit = {
      originalName: fileName,
      size: fileSize,
      metadata: {}
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const file = await storage.create({} as any, fileInit);
    fileId = file.id;
    originalData = generatePatternBuffer(fileSize);

    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const buffer = originalData.slice(start, start + chunkSize);

      chunks.push({
        id: fileId,
        name: fileId,
        size: fileSize,
        start,
        contentLength: buffer.length,
        body: Readable.from(buffer)
      });
    }
  }, 30000);

  it('should upload chunks in parallel and complete on the last one', async () => {
    // Upload all but last chunk in parallel (shuffled order)
    const allButLast = chunks.slice(0, -1);
    const shuffledChunks = [...allButLast].sort(() => Math.random() - 0.5);

    await Promise.all(shuffledChunks.map(part => storage.write(part)));

    // Upload the last chunk last to trigger completion
    await storage.write(chunks[chunks.length - 1]);

    const meta = await storage.getMeta(fileId);
    expect(meta.status).toBe('completed');
    expect(meta.bytesWritten).toBe(fileSize);

    const filePath = storage.getFilePath(fileId);
    const diskData = await fsp.readFile(filePath);
    expect(Buffer.compare(diskData, originalData)).toBe(0);
  }, 60000);

  afterAll(async () => {
    try {
      await storage.delete({ id: fileId });
    } catch {
      // Ignore deletion errors
    } finally {
      vol.reset();
    }
  });
});
