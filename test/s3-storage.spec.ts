import { S3 } from 'aws-sdk';
import { createReadStream } from 'fs';
import { FilePart, S3File, S3Storage } from '../src';
import { filename, metafile, srcpath, storageOptions, testfile } from './fixtures';

const mockHeadBucket = jest.fn();
const mockCreateMultipartUpload = jest.fn(() => ({
  promise() {
    return Promise.resolve({ UploadId: '123456789' });
  }
}));
const mockPutObject = jest.fn(() => ({
  promise() {
    return Promise.resolve();
  }
}));
const mockListObjectsV2 = jest.fn(() => ({
  promise() {
    return Promise.resolve<S3.ListObjectsV2Output>({
      Contents: [
        { Key: 'already.uploaded', LastModified: new Date() },
        { Key: metafile, LastModified: new Date() }
      ]
    });
  }
}));
const mockDeleteObject = jest.fn(() => ({
  promise() {
    return Promise.resolve();
  }
}));
const mockAbortMultipartUpload = jest.fn(() => ({
  promise() {
    return Promise.resolve();
  }
}));
const mockUploadPart = jest.fn(() => ({
  promise() {
    return Promise.resolve();
  }
}));
const mockCompleteMultipartUpload = jest.fn(() => ({
  promise() {
    return Promise.resolve({ Location: '' });
  }
}));
const mockHeadObject = jest.fn(() => ({
  promise() {
    return Promise.resolve({
      Metadata: { metadata: encodeURIComponent(JSON.stringify(testfile)) }
    });
  }
}));
const mockListParts = jest.fn(() => ({
  promise() {
    return Promise.resolve({
      Metadata: { Parts: [{ PartNumber: 1, Size: testfile.size }] }
    });
  }
}));

jest.mock('aws-sdk', () => ({
  S3: jest.fn(
    (): Partial<S3> => ({
      abortMultipartUpload: mockAbortMultipartUpload as any,
      completeMultipartUpload: mockCompleteMultipartUpload as any,
      createMultipartUpload: mockCreateMultipartUpload as any,
      deleteObject: mockDeleteObject as any,
      headBucket: mockHeadBucket as any,
      headObject: mockHeadObject as any,
      listObjectsV2: mockListObjectsV2 as any,
      listParts: mockListParts as any,
      putObject: mockPutObject as any,
      uploadPart: mockUploadPart as any
    })
  )
}));

describe('S3Storage', () => {
  const options = { ...storageOptions };
  testfile.name = filename;

  let file: S3File;
  let storage: S3Storage;
  beforeEach(async () => {
    storage = new S3Storage(options);
    file = {
      ...testfile,
      UploadId: '123456789',
      Parts: []
    } as any;
  });
  describe('.create()', () => {
    it('should request api and set status and uri', async () => {
      mockHeadObject.mockImplementationOnce(() => ({
        promise() {
          return Promise.reject({ statusCode: 404 });
        }
      }));
      file = await storage.create({} as any, testfile);
      expect(file.name).toEqual(filename);
      expect(file.status).toBe('created');
      expect(file).toMatchObject({
        ...testfile,
        UploadId: expect.any(String),
        Parts: expect.any(Array)
      });
      const existing = await storage.create({} as any, testfile);
      expect(file).toMatchObject(existing);
    });
  });
  describe('.update()', () => {
    it('should update changen metadata keys', async () => {
      file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as any);
      expect(file.metadata.name).toBe('newname.mp4');
      expect(file.metadata.mimeType).toBe(testfile.metadata.mimeType);
    });

    it('should reject if not found', async () => {
      expect.assertions(1);
      mockHeadObject.mockImplementationOnce(() => ({
        promise() {
          return Promise.reject({ statusCode: 404 });
        }
      }));
      await expect(
        storage.update(filename, { metadata: { name: 'newname.mp4' } } as any)
      ).rejects.toHaveProperty('statusCode', 404);
    });
  });
  describe('.get()', () => {
    it('should return all user files', async () => {
      const files = await storage.get(testfile.userId);
      expect(files).toEqual(expect.any(Array));
      expect(files.length).toEqual(1);
      expect(files[0]).toMatchObject({ name: filename });
    });
  });
  describe('.write()', () => {
    it('should request api and set status and bytesWritten', async () => {
      const part: FilePart = {
        name: filename,
        body: createReadStream(srcpath),
        start: 0,
        contentLength: testfile.size
      };
      const res = await storage.write(part);
      expect(res.status).toBe('completed');
      expect(res.bytesWritten).toBe(testfile.size);
    });

    it('should request api and set status and bytesWritten on resume', async () => {
      const part: FilePart = {
        name: filename,
        contentLength: 0
      };
      const res = await storage.write(part);
      expect(res.status).toBe('part');
      expect(res.bytesWritten).toBe(0);
    });
  });
  describe('delete()', () => {
    it('should set status', async () => {
      const [deleted] = await storage.delete(filename);
      expect(deleted.status).toBe('deleted');
    });
  });
});
