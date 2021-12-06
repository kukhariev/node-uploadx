/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { createReadStream } from 'fs';
import { AWSError, S3File, S3Storage, S3StorageOptions } from '../packages/s3/src';
import { authRequest, metafilename, srcpath, storageOptions, testfile } from './shared';

const s3Mock = mockClient(S3Client);

describe('S3Storage', () => {
  const options = { ...(storageOptions as S3StorageOptions) };

  let file: S3File;
  let storage: S3Storage;
  const req = authRequest();

  const metafileResponse = {
    Metadata: {
      metadata: encodeURIComponent(
        JSON.stringify({
          ...testfile,
          createdAt: Date.now(),
          bytesWritten: 0,
          status: 'created',
          UploadId: '987654321'
        })
      )
    }
  };

  beforeEach(async () => {
    s3Mock.reset();
    storage = new S3Storage(options);
    file = {
      ...testfile,
      UploadId: '123456789',
      Parts: []
    };
  });

  describe('.create()', () => {
    it('should request api and set status and UploadId', async () => {
      s3Mock.on(HeadObjectCommand).rejects();
      s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: '123456789' });
      file = await storage.create(req, testfile);
      expect(file.name).toEqual(testfile.name);
      expect(file.UploadId).toBe('123456789');
    });

    it('should handle existing', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      file = await storage.create(req, testfile);
      expect(file.name).toEqual(testfile.name);
      expect(file.status).toBe('created');
      expect(file.createdAt).toBeDefined();
      expect(file.UploadId).toBe('987654321');
    });

    it('should send error', async () => {
      s3Mock.on(HeadObjectCommand).rejects();
      s3Mock.on(CreateMultipartUploadCommand).resolves({});
      await expect(storage.create(req, testfile)).rejects.toHaveProperty(
        'uploadxErrorCode',
        'FileError'
      );
    });
  });

  describe('.update()', () => {
    it('should update changed metadata keys', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      file = await storage.update(testfile.id, { metadata: { name: 'newname.mp4' } });
      expect(file.metadata.name).toBe('newname.mp4');
      expect(file.metadata.mimeType).toBe(testfile.metadata.mimeType);
    });

    it('should reject if not found', async () => {
      expect.assertions(1);
      await expect(
        storage.update(testfile.id, { metadata: { name: 'newname.mp4' } })
      ).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
    });
  });

  describe('.list()', () => {
    it('should return all user files', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: metafilename, LastModified: new Date() }]
      });
      const { items } = await storage.list(testfile.userId);
      expect(items).toEqual(expect.any(Array));
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: testfile.id });
    });
  });

  describe('.write()', () => {
    it('should request api and set status and bytesWritten', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
      s3Mock.on(UploadPartCommand).resolves({ ETag: '1234' });
      s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: '/1234' });
      const part = {
        id: testfile.id,
        name: testfile.name,
        body: createReadStream(srcpath),
        start: 0,
        contentLength: testfile.size
      };
      const res = await storage.write(part);
      expect(res.status).toBe('completed');
      expect(res.bytesWritten).toBe(testfile.size);
    });

    it('should request api and set status and bytesWritten on resume', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
      const part = {
        id: testfile.id,
        name: testfile.name,
        contentLength: 0
      };
      const res = await storage.write(part);
      expect(res.status).toBe('part');
      expect(res.bytesWritten).toBe(0);
    });
  });

  describe('delete()', () => {
    it('should set status', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      s3Mock.on(DeleteObjectCommand).resolves({});
      const [deleted] = await storage.delete(testfile.id);
      expect(deleted.status).toBe('deleted');
    });

    it('should ignore if not exist', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      const [deleted] = await storage.delete(testfile.id);
      expect(deleted.id).toBe(testfile.id);
    });
  });

  describe('normalizeError', () => {
    it('aws error', () => {
      const e = {
        $metadata: { httpStatusCode: 400 },
        message: 'SomeServiceException',
        name: 'AWSError',
        Code: 'SomeServiceException'
      };

      expect(storage.normalizeError(e)).toEqual(
        expect.objectContaining({ code: 'SomeServiceException', statusCode: 400 })
      );
    });

    it('not aws error', () => {
      expect(storage.normalizeError(Error('unknown') as AWSError)).toHaveProperty(
        'code',
        'GenericUploadxError'
      );
    });
  });
});
