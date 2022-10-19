/* eslint-disable @typescript-eslint/no-unsafe-assignment */
jest.mock('@aws-sdk/s3-request-presigner');

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
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mockClient } from 'aws-sdk-client-mock';
import { AWSError, S3Storage, S3StorageOptions } from '../packages/s3/src';
import { authRequest, metafile, storageOptions, testfile } from './shared';

const s3Mock = mockClient(S3Client);

describe('S3Storage', () => {
  jest.useFakeTimers().setSystemTime(new Date('2022-02-02'));
  const options = { ...(storageOptions as S3StorageOptions) };

  let storage: S3Storage;
  const req = authRequest();

  const metafileResponse = {
    Metadata: {
      metadata: encodeURIComponent(
        JSON.stringify({
          ...metafile,
          createdAt: new Date().toISOString(),
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
  });

  describe('.create()', () => {
    it('should request api and set status and UploadId', async () => {
      s3Mock.on(HeadObjectCommand).rejects();
      s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: '123456789' });
      const s3file = await storage.create(req, metafile);
      expect(s3file).toMatchSnapshot();
    });

    it('should handle existing', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      const s3file = await storage.create(req, metafile);
      expect(s3file).toMatchSnapshot();
    });

    it('should send error on invalid s3 response', async () => {
      s3Mock.on(HeadObjectCommand).rejects();
      s3Mock.on(CreateMultipartUploadCommand).resolves({});
      await expect(storage.create(req, metafile)).rejects.toMatchSnapshot();
    });
  });

  describe('.update()', () => {
    it('should update changed metadata keys', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      const s3file = await storage.update(metafile, { metadata: { name: 'newname.mp4' } });
      expect(s3file.metadata.name).toBe('newname.mp4');
      expect(s3file.metadata.mimeType).toBe(metafile.metadata.mimeType);
    });

    it('should reject if not found', async () => {
      expect.assertions(1);
      await expect(
        storage.update(metafile, { metadata: { name: 'newname.mp4' } })
      ).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
    });
  });

  describe('.list()', () => {
    it('should return all user files', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: testfile.metafilename, LastModified: new Date() }]
      });
      const { items } = await storage.list(metafile.userId);
      expect(items).toEqual(expect.any(Array));
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: metafile.id });
    });
  });

  describe('.write()', () => {
    it('should request api and set status and bytesWritten', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
      s3Mock.on(UploadPartCommand).resolves({ ETag: '1234' });
      s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: '/1234' });
      const part = {
        id: metafile.id,
        name: metafile.name,
        body: testfile.asReadable,
        start: 0,
        contentLength: metafile.size
      };
      const s3file = await storage.write(part);
      expect(s3file).toMatchSnapshot();
    });

    it('should request api and set status and bytesWritten on resume', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
      const part = {
        id: metafile.id,
        name: metafile.name,
        contentLength: 0
      };
      const s3file = await storage.write(part);
      expect(s3file).toMatchSnapshot();
    });
  });

  describe('delete()', () => {
    it('should set status', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      s3Mock.on(DeleteObjectCommand).resolves({});
      const [deleted] = await storage.delete(metafile);
      expect(deleted.status).toBe('deleted');
    });

    it('should ignore if not exist', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      const [deleted] = await storage.delete(metafile);
      expect(deleted.id).toBe(metafile.id);
    });
  });

  describe('normalizeError', () => {
    it('s3 error', () => {
      const err = {
        $metadata: { httpStatusCode: 400 },
        message: 'SomeServiceException',
        name: 'SomeError',
        Code: 'SomeServiceException'
      };
      expect(storage.normalizeError(err)).toMatchSnapshot();
    });

    it('not s3 error', () => {
      expect(storage.normalizeError(Error('unknown') as AWSError)).toMatchSnapshot();
    });
  });
});

describe('S3PresignedStorage', () => {
  const getSignedUrlMock: jest.Mock = getSignedUrl as any;
  jest.useFakeTimers().setSystemTime(new Date('2022-02-02'));
  const options = { ...(storageOptions as S3StorageOptions), clientDirectUpload: true };

  let storage: S3Storage;
  const req = authRequest();

  const metafileResponse = {
    Metadata: {
      metadata: encodeURIComponent(
        JSON.stringify({
          ...metafile,
          createdAt: new Date().toISOString(),
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
  });

  describe('.create()', () => {
    it('should request api and set status and UploadId', async () => {
      s3Mock.on(HeadObjectCommand).rejects();
      s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: '123456789' });
      s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
      getSignedUrlMock.mockResolvedValue('https://api.s3.example.com?signed');
      const s3file = await storage.create(req, metafile);
      expect(s3file.partsUrls?.length).toBe(1);
      expect(s3file.partSize).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('should add partsUrls', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      s3Mock.on(ListPartsCommand).resolves({ Parts: [] });
      getSignedUrlMock.mockResolvedValue('https://api.s3.example.com?signed');
      const s3file = await storage.update(metafile, metafile);
      expect(s3file.partsUrls?.length).toBe(1);
    });

    it('should complete', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      const preCompleted = {
        ...metafile,
        Parts: [{ PartNumber: 1, Size: 64, ETag: '123456789' }],
        UploadId: '123456789',
        partSize: 16777216,
        partsUrls: ['https://api.s3.example.com?signed']
      };
      s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: '/1234' });
      const s3file = await storage.update({ id: metafile.id }, preCompleted);
      expect(s3file.status).toBe('completed');
    });

    it('should complete (empty payload)', async () => {
      s3Mock.on(HeadObjectCommand).resolves(metafileResponse);
      s3Mock
        .on(ListPartsCommand)
        .resolves({ Parts: [{ PartNumber: 1, Size: 64, ETag: '123456789' }] });
      s3Mock.on(CompleteMultipartUploadCommand).resolves({ Location: '/1234' });
      const s3file = await storage.update({ id: metafile.id }, {});
      expect(s3file.status).toBe('completed');
    });
  });
});
