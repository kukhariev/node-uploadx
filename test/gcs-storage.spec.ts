import { AbortSignal } from 'abort-controller';
import { createReadStream } from 'fs';
import fetch from 'node-fetch';
import { File, FilePart, GCStorage } from '../src';
import { srcpath, testfile } from './fixtures/testfile';
const { Response } = jest.requireActual('node-fetch');

const mockAuthRequest = jest.fn();
jest.mock('node-fetch');
jest.mock('google-auth-library', () => {
  return { GoogleAuth: jest.fn(() => ({ request: mockAuthRequest })) };
});

describe('GCStorage', () => {
  const data = {
    data: {
      ...testfile,
      uri: 'http://api.com?upload_id=123456789'
    }
  };
  let storage: GCStorage;
  let filename: string;
  let file: File;

  beforeEach(() => {
    mockAuthRequest.mockResolvedValue({});
    storage = new GCStorage({});
  });
  afterEach(() => mockAuthRequest.mockReset());

  it('should create file', async () => {
    mockAuthRequest.mockResolvedValue({
      headers: { location: 'http://api.com?upload_id=123456789' }
    });
    const req = { headers: { origin: 'http://api.com' } } as any;
    file = await storage.create(req, testfile);
    filename = file.name;
    expect(file).toMatchObject({
      ...testfile,
      uri: expect.any(String)
    });
    const existing = await storage.create(req, testfile);
    expect(file).toMatchObject(existing);
  });

  it('should update metadata', async () => {
    mockAuthRequest.mockResolvedValue(data);
    file = await storage.update(filename, { metadata: { name: 'newname.mp4' } } as File);
    expect(file.metadata.name).toBe('newname.mp4');
    expect(file.originalName).toBe('newname.mp4');
    expect(file.metadata.mimeType).toBe('video/mp4');
  });

  // it('should return user files', async () => {
  //   mockAuthRequest.mockResolvedValue(data);
  //   const files = await storage.get(testfile.userId);
  //   expect(files.length).toBeGreaterThan(0);
  // });

  it('should write', async () => {
    mockAuthRequest.mockResolvedValue(data);
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
    mockAuthRequest.mockResolvedValue(data);
    const [deleted] = await storage.delete(filename);
    expect(deleted.name).toBe(filename);
  });
});
