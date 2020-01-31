import { S3 } from 'aws-sdk';
import { createReadStream } from 'fs';
import { File, FilePart, S3Storage, S3File } from '../src';
import { filename, metafile, srcpath, storageOptions, testfile } from './fixtures';

const mockHeadBucket = jest.fn();
const mockCreateMultipartUpload = jest.fn(params => ({
  promise() {
    return Promise.resolve({ UploadId: '123456789' });
  }
}));
const mockPutObject = jest.fn(params => ({
  promise() {
    return Promise.resolve();
  }
}));
const mockListObjectsV2 = jest.fn(params => ({
  promise() {
    return Promise.resolve<S3.ListObjectsV2Output>({
      Contents: [
        { Key: 'already.uploaded', LastModified: new Date() },
        { Key: metafile, LastModified: new Date() }
      ]
    });
  }
}));
const mockDeleteObject = jest.fn(params => ({
  promise() {
    return Promise.resolve();
  }
}));
const mockAbortMultipartUpload = jest.fn(params => ({
  promise() {
    return Promise.resolve();
  }
}));
const mockUploadPart = jest.fn(params => ({
  promise() {
    return Promise.resolve();
  }
}));
const mockCompleteMultipartUpload = jest.fn(params => ({
  promise() {
    return Promise.resolve({ Location: '' });
  }
}));
const mockHeadObject = jest.fn(params => ({
  promise() {
    return Promise.resolve({
      Metadata: { metadata: encodeURIComponent(JSON.stringify(testfile)) }
    });
  }
}));
const mockListParts = jest.fn(params => ({
  promise() {
    return Promise.resolve({
      Metadata: { Parts: [{ PartNumber: 1, Size: testfile.size }] }
    });
  }
}));

jest.mock('aws-sdk', () => {
  return {
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
  };
});

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
    };
  });

  it('should create file', async () => {
    mockHeadObject.mockImplementationOnce(params => ({
      promise() {
        return Promise.reject({ statusCode: 404 });
      }
    }));
    file = await storage.create({} as any, testfile);
    expect(file.name).toEqual(filename);
    expect(file.status).toBe<File['status']>('created');
    expect(file).toMatchObject({
      ...testfile,
      UploadId: expect.any(String),
      Parts: expect.any(Array)
    });
    const existing = await storage.create({} as any, testfile);
    expect(file).toMatchObject(existing);
  });

  it('should update metadata', async () => {
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe(testfile.metadata.mimeType);
  });

  it('should `not found` error', async () => {
    expect.assertions(1);
    mockHeadObject.mockImplementationOnce(params => ({
      promise() {
        return Promise.reject({ statusCode: 404 });
      }
    }));
    await expect(
      storage.update(filename, { metadata: { name: 'newname.mp4' } } as any)
    ).rejects.toHaveProperty('statusCode', 404);
  });

  it('should return user files', async () => {
    const files = await storage.get(testfile.userId);
    expect(files).toEqual(expect.any(Array));
    expect(files.length).toEqual(1);
    expect(files[0]).toMatchObject({ name: filename });
  });

  it('should write', async () => {
    const part: FilePart = {
      name: filename,
      body: createReadStream(srcpath),
      start: 0,
      contentLength: testfile.size
    };
    const res = await storage.write(part);
    expect(res.status).toBe<File['status']>('completed');
    expect(res.bytesWritten).toBe(testfile.size);
  });

  it('should delete file', async () => {
    const [deleted] = await storage.delete(filename);
    expect(deleted.status).toBe<File['status']>('deleted');
  });
});
