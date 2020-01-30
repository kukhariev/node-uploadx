import { join } from 'path';
import { DiskStorage, File } from '../src';
import { filename, metafile, root, storageOptions, testfile } from './fixtures';
import { PassThrough } from 'stream';

const directory = join(root, 'ds-test');
const options = { ...storageOptions, directory };

class FileWriteStream extends PassThrough {
  get bytesWritten(): number {
    return super.readableLength;
  }

  close(): void {
    return;
  }
}

let writeStream: FileWriteStream;

jest.mock('../src/utils/fs', () => ({
  ensureFile: async () => 0,
  getFiles: async () => [join(directory, filename), join(directory, metafile)],
  getWriteStream: () => writeStream,
  fsp: {
    stat: async () => ({ mtime: new Date() }),
    writeFile: async () => 0,
    readFile: async () => JSON.stringify(testfile),
    unlink: async () => null
  }
}));

describe('DiskStorage', () => {
  const storage = new DiskStorage(options);
  let mockReadable: PassThrough;

  beforeEach(async () => {
    writeStream = new FileWriteStream();
    mockReadable = new PassThrough();
    await storage.create({} as any, testfile);
  });

  it('should create file', async () => {
    const { size, status, bytesWritten } = await storage.create({} as any, testfile);
    expect(bytesWritten).toBe(0);
    expect(size).toBe(testfile.size);
    expect(status).toBe('created');
  });

  it('should update metadata', async () => {
    const file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should resume', async () => {
    const file = await storage.write({ ...testfile });
    expect(file.bytesWritten).toBe(0);
  });

  it('should write error', async () => {
    setTimeout(() => {
      mockReadable.emit('data', '12345');
      mockReadable.emit('data', '12345');
      writeStream.emit('error', 'write error');
    }, 100);
    const stream = storage.write({ ...testfile, start: 0, body: mockReadable });
    await expect(stream).rejects.toHaveProperty('statusCode', 500);
  });

  it('should close on abort', async () => {
    const close = spyOn(writeStream, 'close');
    setTimeout(() => {
      mockReadable.emit('data', '12345');
      mockReadable.emit('aborted');
      mockReadable.emit('end');
    }, 100);
    const file = await storage.write({ ...testfile, start: 0, body: mockReadable });
    expect(+file.bytesWritten).toBeNaN();
    expect(close).toBeCalled();
  });

  it('should write', async () => {
    setTimeout(() => {
      mockReadable.emit('data', '12345');
      mockReadable.emit('data', '12345');
      mockReadable.emit('end');
    }, 100);

    const file = await storage.write({ ...testfile, start: 0, body: mockReadable });
    expect(file.status).toBe('part');
    expect(file.bytesWritten).toBe(10);
  });

  it('should return files', async () => {
    const files = await storage.get(testfile.userId);
    expect(files).toEqual(expect.any(Array));
    expect(files.length).toEqual(1);
    expect(files[0]).toMatchObject({ name: filename });
  });

  it('should return file', async () => {
    const files = await storage.get(filename);
    expect(files).toEqual(expect.any(Array));
  });

  it('should delete file', async () => {
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
    expect(deleted.status).toBe<File['status']>('deleted');
  });
});
