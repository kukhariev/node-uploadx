/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AbortSignal } from 'abort-controller';
import { IncomingMessage } from 'http';
import fetch from 'node-fetch';
import { FilePart } from '../packages/core/src';
import {
  buildContentRange,
  ClientError,
  GCSFile,
  GCSMetaStorage,
  GCStorage,
  getRangeEnd
} from '../packages/gcs/src';
import { authRequest, deepClone, metafile, storageOptions, testfile } from './shared';

jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const { Response } = jest.requireActual('node-fetch');

const mockAuthRequest = jest.fn();
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(() => ({ request: mockAuthRequest }))
}));

describe('GCStorage', () => {
  jest.useFakeTimers().setSystemTime(new Date('2022-02-02'));
  let storage: GCStorage;
  const uri = 'http://api.com?upload_id=123456789';
  const req = authRequest({ headers: { origin: 'http://api.com' } } as IncomingMessage);
  const metafileResponse = (): { data: GCSFile } =>
    deepClone({
      data: { ...metafile, uri, createdAt: new Date().toISOString() }
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuthRequest.mockResolvedValueOnce({ bucket: 'ok' });
    storage = new GCStorage({ ...storageOptions, bucket: 'test-bucket' });
  });

  describe('initialization', () => {
    it('should set defaults', () => {
      mockAuthRequest.mockResolvedValueOnce({ bucket: 'ok' });
      storage = new GCStorage();
      expect(storage.meta).toBeInstanceOf(GCSMetaStorage);
      expect(storage.bucket).toBeDefined();
    });

    it('should share logger', () => {
      expect(storage.logger).toBe(storage.meta.logger);
    });
  });

  describe('.create()', () => {
    it('should request api and set status and uri', async () => {
      mockAuthRequest.mockRejectedValueOnce({ code: 404, detail: 'meta not found' }); // getMeta
      mockAuthRequest.mockResolvedValueOnce({ headers: { location: uri } }); //
      mockAuthRequest.mockResolvedValueOnce('_saveOk');
      const gcsFile = await storage.create(req, metafile);
      expect(gcsFile).toMatchSnapshot();
      expect(mockAuthRequest).toMatchSnapshot();
    });

    it('should handle existing', async () => {
      mockAuthRequest.mockResolvedValue(metafileResponse());
      // eslint-disable-next-line
      mockFetch.mockResolvedValueOnce(new Response('', { status: 308, headers: { Range: '0-5' } }));
      const gcsFile = await storage.create(req, metafile);
      expect(gcsFile).toMatchSnapshot();
    });

    it('should reject on api error', async () => {
      const errorObject = { code: 403, response: {} };
      mockAuthRequest.mockRejectedValue(errorObject);
      await expect(storage.create(req, metafile)).rejects.toEqual(errorObject);
    });
  });

  describe('.update()', () => {
    it('should update metadata keys', async () => {
      mockAuthRequest.mockResolvedValue(metafileResponse());
      const gcsFile = await storage.update(metafile, { metadata: { name: 'newname.mp4' } });
      expect(gcsFile.metadata.name).toBe('newname.mp4');
      expect(gcsFile.originalName).toBe('newname.mp4');
      expect(gcsFile.metadata.mimeType).toBe('video/mp4');
    });

    it('should reject if not found', async () => {
      mockAuthRequest.mockResolvedValue({});
      await expect(
        storage.update(metafile, { metadata: { name: 'newname.mp4' } })
      ).rejects.toHaveProperty('uploadxErrorCode', 'FileNotFound');
    });
  });

  describe('.list()', () => {
    it('should return all user files', async () => {
      const list = { data: { items: [{ name: testfile.metafilename }] } };
      mockAuthRequest.mockResolvedValue(list);
      const { items } = await storage.list(metafile.userId);
      expect(items).toMatchSnapshot();
    });
  });

  describe('.write()', () => {
    it('should request api and set status and bytesWritten', async () => {
      mockAuthRequest.mockResolvedValueOnce(metafileResponse());
      mockFetch.mockResolvedValueOnce(
        // eslint-disable-next-line
        new Response('{"mediaLink":"http://api.com/123456789"}', { status: 200 })
      );
      const body = testfile.asReadable;
      const gcsFile = await storage.write({
        id: metafile.id,
        body,
        start: 0,
        contentLength: metafile.size
      });
      expect(mockFetch).toHaveBeenCalledWith(uri, {
        body,
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Range': 'bytes 0-63/64' }),
        signal: expect.any(AbortSignal)
      });
      expect(gcsFile).toMatchSnapshot();
    });

    it('should send normalised error', async () => {
      mockAuthRequest.mockResolvedValueOnce(metafileResponse());
      // eslint-disable-next-line
      mockFetch.mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));
      await expect(storage.write({ id: metafile.id, contentLength: 0 })).rejects.toEqual({
        code: 'GCS400',
        config: { uri: 'http://api.com?upload_id=123456789' },
        message: 'Bad Request',
        name: 'FetchError'
      });
    });

    it('should request api and set status and bytesWritten on resume', async () => {
      mockAuthRequest.mockResolvedValueOnce(metafileResponse());
      // eslint-disable-next-line
      mockFetch.mockResolvedValueOnce(new Response('', { status: 308, headers: { Range: '0-5' } }));
      const gcsFile = await storage.write({ id: metafile.id, contentLength: 0 });
      expect(mockFetch).toMatchSnapshot();
      expect(gcsFile.status).toBe('part');
      expect(gcsFile.bytesWritten).toBe(6);
    });
  });

  describe('.delete()', () => {
    it('should set status', async () => {
      mockAuthRequest.mockResolvedValue({ data: { ...metafile, uri } });
      const [deleted] = await storage.delete(metafile);
      expect(deleted.id).toBe(metafile.id);
      expect(deleted.status).toBe('deleted');
    });

    it('should ignore if not exist', async () => {
      mockAuthRequest.mockResolvedValue({});
      const [deleted] = await storage.delete(metafile);
      expect(deleted.id).toBe(metafile.id);
    });
  });

  describe('normalizeError', () => {
    it('client error', () => {
      const e: ClientError = {
        code: '400',
        config: { uri: 'http://api.com?upload_id=123456789' },
        message: 'Bad Request',
        name: 'ClientError'
      };

      expect(storage.normalizeError(e)).toEqual(
        expect.objectContaining({ code: 'GCS400', statusCode: 400 })
      );
    });

    it('not client error', () => {
      expect(storage.normalizeError(Error('unknown') as ClientError)).toEqual(
        expect.objectContaining({ code: 'GenericUploadxError' })
      );
    });
  });
});

describe('Range utils', () => {
  it.each([
    ['', 0],
    ['0-0', 0],
    ['0-1', 2],
    ['0-10000', 10001]
  ])('getRangeEnd(%s) === %i', (str, expected) => {
    expect(getRangeEnd(str)).toBe(expected);
  });

  const body = true;

  it.each([
    [{}, 'bytes */*'],
    [{ body }, 'bytes */*'],
    [{ start: 0 }, 'bytes */*'],
    [{ start: 0, body }, 'bytes 0-*/*'],
    [{ start: 10, size: 80, body }, 'bytes 10-*/80'],
    [{ start: 0, contentLength: 80, size: 80, body }, 'bytes 0-79/80'],
    [{ start: 0, contentLength: 80, size: 80 }, 'bytes */80']
  ])('buildContentRange(%o) === %s', (str, expected) => {
    expect(buildContentRange(str as FilePart & GCSFile)).toBe(expected);
  });
});
