import * as fs from 'fs';
import { join } from 'path';
import * as request from 'supertest';
import { serializeMetadata, tus } from '../src/handlers/tus';
import { app, rm, root, storageOptions } from './_utils/app';
import { metadata, srcpath } from './_utils/testfile';

describe('::Tus', () => {
  let res: request.Response;
  const files: string[] = [];
  const basePath = '/tus';
  const directory = join(root, 'tus');
  const opts = { ...storageOptions, directory };
  app.use(basePath, tus(opts));

  beforeAll(() => rm(directory));
  afterAll(() => rm(directory));
  beforeEach(() => (res = undefined as any));

  test('wrapper', () => {
    expect(tus()).toBeInstanceOf(Function);
  });

  describe('POST', () => {
    it('should 200', async () => {
      res = await request(app)
        .post(basePath)
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
        .head(basePath)
        .set('Tus-Resumable', '1.0.0')
        .expect(404);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      res = await request(app)
        .options(basePath)
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
        .delete(basePath)
        .set('Tus-Resumable', '1.0.0')
        .expect(404);
    });
  });
});
