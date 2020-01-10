/* set AWS environment variables to pass this test */

import { S3 } from 'aws-sdk';
import { createReadStream } from 'fs';
import { File, FilePart, S3File, S3Storage } from '../src';
import { srcpath, testfile } from './server/testfile';

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
  if (process.env.S3_BUCKET) {
    return require.requireActual('aws-sdk');
  }
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

describe('S3Storage', () => {
  let filename: string;
  let file: File;

  const storage = new S3Storage({});

  it('should create file', async () => {
    mockHeadObject.mockImplementation(params => {
      return {
        promise() {
          return Promise.reject();
        }
      };
    });
    file = await storage.create({} as any, testfile);
    filename = file.name;
    expect((file as S3File)['UploadId']).not.toHaveLength(0);
  });

  it('should update metadata', async () => {
    mockHeadObject.mockImplementation(params => {
      return {
        promise() {
          return Promise.resolve({
            Metadata: { metadata: encodeURIComponent(JSON.stringify(testfile)) }
          });
        }
      };
    });
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect.assertions(2);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should return user files', async () => {
    const files = await storage.get(file.userId);
    expect(Object.keys(files)).not.toHaveLength(0);
  });

  it('should write', async () => {
    const part: FilePart = {
      name: filename,
      body: createReadStream(srcpath),
      start: 0,
      contentLength: testfile.size
    };
    const res = await storage.write(part);
    expect(res.bytesWritten).toEqual(testfile.size);
  });

  it('should delete file', async () => {
    mockHeadObject.mockImplementation(params => {
      return {
        promise() {
          return Promise.reject();
        }
      };
    });
    await storage.create({} as any, testfile);
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
  });
});
