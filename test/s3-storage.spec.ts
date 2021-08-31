/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { mockClient } from 'aws-sdk-client-mock';

import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  // PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { S3File, S3Storage } from '../packages/s3/src';
import { FilePart } from '../packages/core/src';
import { storageOptions } from './fixtures';
import { filename, metafile, srcpath, testfile } from './fixtures/testfile';
import { S3StorageOptions } from '../packages/s3/src';

const s3Mock = mockClient(S3Client);
jest.mock('../packages/core/src/utils/cache');

describe('S3Storage', () => {
  const options = { ...(storageOptions as S3StorageOptions) };
  testfile.name = filename;

  let file: S3File;
  let storage: S3Storage;

  beforeEach(async () => {
    s3Mock.reset();
    storage = new S3Storage(options);
    file = {
      ...testfile,
      UploadId: '123456789',
      Parts: []
    } as unknown as S3File;
  });

  describe('.create()', () => {
    it('should request api and set status and uri', async () => {
      s3Mock.on(HeadObjectCommand).rejects();
      s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: '123456789' });
      file = await storage.create({} as any, testfile);
      expect(file.name).toEqual(filename);
      expect(file.status).toBe('created');
      expect(file).toMatchObject({
        ...testfile,
        UploadId: expect.any(String)
      });
    });
  });

  describe('.update()', () => {
    it('should update changed metadata keys', async () => {
      s3Mock.on(HeadObjectCommand).resolves({
        Metadata: { metadata: encodeURIComponent(JSON.stringify(testfile)) }
      });
      file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as any);
      expect(file.metadata.name).toBe('newname.mp4');
      expect(file.metadata.mimeType).toBe(testfile.metadata.mimeType);
    });

    it('should reject if not found', async () => {
      expect.assertions(1);
      await expect(
        storage.update(filename, { metadata: { name: 'newname.mp4' } } as any)
      ).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
    });
  });

  describe('.list()', () => {
    it('should return all user files', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: metafile, LastModified: new Date() }]
      });
      const { items } = await storage.list(testfile.userId);
      expect(items).toEqual(expect.any(Array));
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ name: filename });
    });
  });

  describe('.write()', () => {
    it('should request api and set status and bytesWritten', async () => {
      s3Mock.on(HeadObjectCommand).resolves({
        Metadata: { metadata: encodeURIComponent(JSON.stringify(testfile)) }
      });
      s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
      s3Mock.on(UploadPartCommand).resolves({ ETag: '1234' });
      s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: '/1234' });
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
      s3Mock.on(HeadObjectCommand).resolves({
        Metadata: { metadata: encodeURIComponent(JSON.stringify(testfile)) }
      });
      s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
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
      s3Mock.on(HeadObjectCommand).resolves({
        Metadata: { metadata: encodeURIComponent(JSON.stringify(testfile)) }
      });
      s3Mock.on(DeleteObjectCommand).resolves({});
      const [deleted] = await storage.delete(filename);
      expect(deleted.status).toBe('deleted');
    });
  });
});
