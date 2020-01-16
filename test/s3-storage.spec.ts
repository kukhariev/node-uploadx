import { S3 } from 'aws-sdk';
import { createReadStream } from 'fs';
import { File, FilePart, S3Storage } from '../src';
import { srcpath, testfile } from './fixtures/testfile';

const mockCreateMultipartUpload = jest.fn();
const mockHeadBucket = jest.fn();
const mockPutObject = jest.fn();
const mockListObjectsV2 = jest.fn();
const mockDeleteObject = jest.fn();
const mockAbortMultipartUpload = jest.fn();
const mockUploadPart = jest.fn();
const mockCompleteMultipartUpload = jest.fn();
const mockHeadObject = jest.fn();
const mockListParts = jest.fn();

mockDeleteObject.mockImplementation(params => {
  return {
    promise() {
      return Promise.resolve();
    }
  };
});
mockAbortMultipartUpload.mockImplementation(params => {
  return {
    promise() {
      return Promise.resolve();
    }
  };
});
mockCreateMultipartUpload.mockImplementation(params => {
  return {
    promise() {
      return Promise.resolve({ UploadId: '123456789' });
    }
  };
});
mockPutObject.mockImplementation(params => {
  return {
    promise() {
      return Promise.resolve();
    }
  };
});
mockListObjectsV2.mockImplementation(params => {
  return {
    promise() {
      return Promise.resolve({ Contents: [{}] });
    }
  };
});
mockUploadPart.mockImplementation(params => {
  return {
    promise() {
      return Promise.resolve();
    }
  };
});
mockCompleteMultipartUpload.mockImplementation(params => {
  return {
    promise() {
      return Promise.resolve({ Location: '' });
    }
  };
});

mockListParts.mockImplementation(params => {
  return {
    promise() {
      return Promise.resolve({
        Metadata: { Parts: [{ PartNumber: 1, Size: testfile.size }] }
      });
    }
  };
});

jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn(
      (): Partial<S3> => ({
        createMultipartUpload: mockCreateMultipartUpload,
        headBucket: mockHeadBucket,
        putObject: mockPutObject,
        listObjectsV2: mockListObjectsV2,
        deleteObject: mockDeleteObject,
        abortMultipartUpload: mockAbortMultipartUpload,
        uploadPart: mockUploadPart,
        completeMultipartUpload: mockCompleteMultipartUpload,
        headObject: mockHeadObject,
        listParts: mockListParts
      })
    )
  };
});

const headResponseObject = { Metadata: { metadata: encodeURIComponent(JSON.stringify(testfile)) } };

describe('S3Storage', () => {
  let filename: string;
  let file: File;
  let storage: S3Storage;
  beforeEach(() => {
    storage = new S3Storage({});
    mockHeadObject.mockReset();
  });

  it('should create file', async () => {
    mockHeadObject.mockImplementation(params => {
      return {
        promise() {
          return Promise.reject({ statusCode: 404 });
        }
      };
    });
    file = await storage.create({} as any, testfile);
    filename = file.name;
    expect(file).toMatchObject({
      ...testfile,
      UploadId: expect.any(String),
      Parts: expect.any(Array)
    });
    const existing = await storage.create({} as any, testfile);
    expect(file).toMatchObject(existing);
  });

  it('should update metadata', async () => {
    mockHeadObject.mockImplementation(params => {
      return {
        promise() {
          return Promise.resolve(headResponseObject);
        }
      };
    });
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should return user files', async () => {
    mockHeadObject.mockImplementation(params => {
      return {
        promise() {
          return Promise.resolve(headResponseObject);
        }
      };
    });
    const files = await storage.get(file.userId);
    expect(Object.keys(files)).not.toHaveLength(0);
  });

  it('should write', async () => {
    mockHeadObject.mockImplementation(params => {
      return {
        promise() {
          return Promise.resolve(headResponseObject);
        }
      };
    });
    const part: FilePart = {
      name: filename,
      body: createReadStream(srcpath),
      start: 0,
      contentLength: testfile.size
    };
    const res = await storage.write(part);
    expect(res.bytesWritten).toBe(testfile.size);
  });

  it('should delete file', async () => {
    mockHeadObject.mockImplementation(params => {
      return {
        promise() {
          return Promise.resolve(headResponseObject);
        }
      };
    });
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
  });
});
