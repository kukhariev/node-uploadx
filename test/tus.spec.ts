import * as fs from 'fs';
import * as request from 'supertest';
import { serializeMetadata, tus } from '../src/handlers/tus';
import { app, metadata, srcpath, TUS_PATH, uploadDirCleanup } from './server';

describe('::Tus', () => {
  const files: string[] = [];
  let res: request.Response;

  beforeAll(uploadDirCleanup);
  afterAll(uploadDirCleanup);
  beforeEach(() => (res = undefined as any));

  test('wrapper', () => {
    expect(tus()).toBeInstanceOf(Function);
  });

  describe('POST', () => {
    it('should 200', async () => {
      res = await request(app)
        .post(TUS_PATH)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Metadata', serializeMetadata(metadata))
        .set('Upload-Length', metadata.size.toString())
        .set('Tus-Resumable', '1.0.0')
        .send(fs.readFileSync(srcpath))
        .expect(200);
      expect(res.header['location']).toBeDefined();
      files.push(res.header.location);
    });
  });

  describe('HEAD', () => {
    it('should 204', async () => {
      res = await request(app)
        .head(files[0])
        .set('Tus-Resumable', '1.0.0')
        .expect(204);
      expect(res.header).toHaveProperty('upload-offset');
      expect(res.header).toHaveProperty('upload-metadata');
      expect(res.header).toHaveProperty('tus-resumable');
    });

    it('should 404', async () => {
      res = await request(app)
        .head(TUS_PATH)
        .set('Tus-Resumable', '1.0.0')
        .expect(404);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      res = await request(app)
        .options(TUS_PATH)
        .set('Tus-Resumable', '1.0.0')
        .expect(204);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      res = await request(app)
        .delete(files[0])
        .set('Tus-Resumable', '1.0.0')
        .expect(204);
    });

    it('should 404', async () => {
      res = await request(app)
        .delete(TUS_PATH)
        .set('Tus-Resumable', '1.0.0')
        .expect(404);
    });
  });
});
