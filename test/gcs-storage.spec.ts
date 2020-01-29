import { AbortSignal } from 'abort-controller';
import { createReadStream } from 'fs';
import fetch from 'node-fetch';
import { GCSFile, FilePart, GCStorage } from '../src';
import { filename, metafile, srcpath, storageOptions, testfile } from './fixtures';
const { Response } = jest.requireActual('node-fetch');

const mockAuthRequest = jest.fn();
jest.mock('node-fetch');
jest.mock('google-auth-library', () => {
  return { GoogleAuth: jest.fn(() => ({ request: mockAuthRequest })) };
});

describe('GCStorage', () => {
  const options = { ...storageOptions };
  const uri = 'http://api.com?upload_id=123456789';
  const successResponse = { data: { ...testfile, uri } };
  const errorObject = { code: 401, response: {} };
  const createResponse = { headers: { location: 'http://api.com?upload_id=123456789' } };

  let storage: GCStorage;
  let file: GCSFile;

  beforeEach(() => {
    mockAuthRequest.mockResolvedValue({});
    storage = new GCStorage(options);
  });
  afterEach(() => mockAuthRequest.mockReset());

  it('should create file', async () => {
    mockAuthRequest.mockRejectedValueOnce({});
    mockAuthRequest.mockResolvedValueOnce(createResponse);
    mockAuthRequest.mockResolvedValue({});
    const req = { headers: { origin: 'http://api.com' } } as any;
    file = await storage.create(req, testfile);
    expect(file.name).toEqual(filename);
    expect(file).toMatchObject({
      ...testfile,
      uri: expect.any(String)
    });
    expect(mockAuthRequest).toHaveBeenCalledTimes(4);
    const existing = await storage.create(req, testfile);
    expect(file).toMatchObject(existing);
  });

  it('should create error', async () => {
    mockAuthRequest.mockRejectedValue(errorObject);
    const req = { headers: { origin: 'http://api.com' } } as any;
    await expect(storage.create(req, testfile)).rejects.toEqual(errorObject);
  });

  it('should update metadata', async () => {
    mockAuthRequest.mockResolvedValue(successResponse);
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as GCSFile);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.originalName).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  it('should `not found` error', async () => {
    expect.assertions(1);
    mockAuthRequest.mockResolvedValue({});
    await expect(
      storage.update(filename, { metadata: { name: 'newname.mp4' } } as any)
    ).rejects.toHaveProperty('statusCode', 404);
  });

  it('should return user files', async () => {
    const list = {
      data: { items: [{ name: metafile }] }
    };
    mockAuthRequest.mockResolvedValue(list);
    const files = await storage.get(testfile.userId);
    expect(files).toEqual(expect.any(Array));
    expect(files.length).toEqual(1);
    expect(files[0]).toMatchObject({ name: filename });
  });

  it('should update', async () => {
    mockAuthRequest.mockResolvedValue(successResponse);
    ((fetch as unknown) as jest.Mock).mockResolvedValue(
      new Response('{"mediaLink":"http://api.com/123456789"}')
    );
    const body = createReadStream(srcpath);
    const part: FilePart = {
      name: filename,
      body,
      start: 0,
      contentLength: testfile.size
    };
    const res = await storage.write(part);
    expect(fetch).toHaveBeenCalledWith('http://api.com?upload_id=123456789', {
      body,
      method: 'PUT',
      headers: expect.any(Object),
      signal: expect.any(AbortSignal)
    });
    expect(res.bytesWritten).toEqual(testfile.size);
  });

  it('should delete file', async () => {
    mockAuthRequest.mockResolvedValue(successResponse);
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
    expect(deleted.status).toBe<GCSFile['status']>('deleted');
  });
});
