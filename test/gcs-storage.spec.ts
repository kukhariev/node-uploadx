/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AbortSignal } from 'abort-controller';
import { createReadStream } from 'fs';
import { buildContentRange, FilePart, GCSFile, GCStorage, getRangeEnd } from '../src';
import { filename, metafile, srcpath, storageOptions, testfile } from './fixtures';
import { request } from './fixtures/gcs';

const mockFetch = require('node-fetch');
const { Response } = jest.requireActual('node-fetch');

jest.mock('node-fetch');
const mockAuthRequest = jest.fn();
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(() => ({ request: mockAuthRequest }))
}));

describe('GCStorage', () => {
  let storage: GCStorage;
  let file: GCSFile;
  const uri = 'http://api.com?upload_id=123456789';
  const _fileResponse = () => ({ data: { ...testfile, uri } });
  const _createResponse = () => ({ headers: { location: uri } });
  const req = { headers: { origin: 'http://api.com' } } as any;

  beforeEach(async () => {
    mockAuthRequest.mockResolvedValue({ buket: 'ok' });
    storage = new GCStorage({ ...storageOptions });
    file = _fileResponse().data;
  });

  afterEach(() => mockAuthRequest.mockReset());

  describe('.create()', () => {
    it('should request api and set status and uri', async () => {
      mockAuthRequest
        .mockRejectedValueOnce({ code: 404 })
        .mockResolvedValueOnce(_createResponse())
        .mockResolvedValue({});
      file = await storage.create(req, testfile);
      expect(file.name).toEqual(filename);
      expect(file.status).toEqual('created');
      expect(file).toMatchObject({ ...testfile, uri });
      expect(mockAuthRequest).toHaveBeenCalledTimes(4);
      expect(mockAuthRequest).toBeCalledWith(request.create);
      const existing = await storage.create(req, testfile);
      expect(file).toMatchObject(existing);
    });

    it('should reject on api error', async () => {
      const errorObject = { code: 403, response: {} };
      mockAuthRequest.mockRejectedValue(errorObject);
      await expect(storage.create(req, testfile)).rejects.toEqual(errorObject);
    });
  });
  describe('.update()', () => {
    it('should update changen metadata keys', async () => {
      mockAuthRequest.mockResolvedValue(_fileResponse());
      file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as GCSFile);
      expect(file.metadata.name).toBe('newname.mp4');
      expect(file.originalName).toBe('newname.mp4');
      expect(file.metadata.mimeType).toBe('video/mp4');
    });

    it('should reject if not found', async () => {
      mockAuthRequest.mockResolvedValue({});
      await expect(
        storage.update(filename, { metadata: { name: 'newname.mp4' } } as any)
      ).rejects.toHaveProperty('statusCode', 404);
    });
  });
  describe('.get()', () => {
    it('should return all user files', async () => {
      const list = {
        data: { items: [{ name: metafile }] }
      };
      mockAuthRequest.mockResolvedValue(list);
      const files = await storage.get(testfile.userId);
      expect(files).toEqual(expect.any(Array));
      expect(files.length).toEqual(1);
      expect(files[0]).toMatchObject({ name: filename });
    });
  });
  describe('.write()', () => {
    it('should request api and set status and bytesWritten', async () => {
      mockAuthRequest.mockResolvedValueOnce(_fileResponse());
      mockFetch.mockResolvedValueOnce(new Response('{"mediaLink":"http://api.com/123456789"}'));
      const body = createReadStream(srcpath);
      const part: FilePart = {
        name: filename,
        body,
        start: 0,
        contentLength: testfile.size
      };
      const res = await storage.write(part);
      expect(mockFetch).toHaveBeenCalledWith(uri, {
        body,
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Range': 'bytes 0-80494/80495' }),
        signal: expect.any(AbortSignal)
      });
      expect(res.status).toEqual('completed');
      expect(res.bytesWritten).toEqual(testfile.size);
    });

    it('should request api and set status and bytesWritten on resume', async () => {
      mockAuthRequest.mockResolvedValueOnce(_fileResponse());
      mockFetch.mockResolvedValueOnce(
        new Response('', {
          status: 308,
          headers: { Range: '0-5' }
        })
      );
      const part: FilePart = { name: filename, contentLength: 0 };
      const res = await storage.write(part);
      expect(mockFetch).toHaveBeenCalledWith(uri, {
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Range': 'bytes */80495' })
      });
      expect(res.status).toEqual('part');
      expect(res.bytesWritten).toEqual(6);
    });
  });
  describe('.delete()', () => {
    it('should set status', async () => {
      mockAuthRequest.mockResolvedValue({ data: { ...testfile, uri } });
      const [deleted] = await storage.delete(filename);
      expect(deleted.name).toBe(filename);
      expect(deleted.status).toBe('deleted');
    });
  });
});

describe('Range utils', () => {
  it.each([
    ['', -1],
    ['0--1', -1],
    ['0-0', 0],
    ['0-1', 1]
  ])('getRangeEnd(%s) === %i', (str, expected) => {
    expect(getRangeEnd(str)).toBe(expected);
  });

  it.each([
    [{}, 'bytes */*'],
    [{ start: 0 }, 'bytes 0-*/*'],
    [{ start: 10, size: 80 }, 'bytes 10-*/80'],
    [{ start: 0, contentLength: 80, size: 80 }, 'bytes 0-79/80']
  ])('buildContentRange(%o) === %p', (str, expected) => {
    expect(buildContentRange(str)).toBe(expected);
  });
});
