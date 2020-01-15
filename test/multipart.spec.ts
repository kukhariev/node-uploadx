import { join } from 'path';
import * as request from 'supertest';
import { multipart } from '../src/handlers/multipart';
import { app, storageOptions, rm, root } from './_utils/app';
import { metadata, srcpath } from './_utils/testfile';

describe('::Multipart', () => {
  let res: request.Response;
  const files: string[] = [];
  const basePath = '/multipart';
  const directory = join(root, 'multipart');
  const opts = { ...storageOptions, directory };
  app.use(basePath, multipart(opts));

  beforeAll(() => rm(directory));
  afterAll(() => rm(directory));
  beforeEach(() => (res = undefined as any));

  test('wrapper', () => {
    expect(multipart()).toBeInstanceOf(Function);
  });

  describe('POST', () => {
    it('should 201 (no metadata)', async () => {
      res = await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .field('custom', JSON.stringify(metadata))
        .attach('file', srcpath, metadata.name)
        .expect(201);
      expect(res.body.size).toBeDefined();
      expect(res.header['location']).toBeDefined();
      files.push(res.header.location);
    });

    it('should 201 (metadata)', async () => {
      expect.assertions(2);
      res = await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .field('metadata', JSON.stringify(metadata))
        .attach('file', srcpath, metadata.name)
        .expect(201);
      expect(res.body.size).toBeDefined();
      expect(res.header['location']).toBeDefined();
    });

    it('should 403 (unsupported filetype)', async () => {
      res = await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .attach('file', 'package.json', metadata.name)
        .expect(403);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      res = await request(app)
        .options(basePath)
        .expect(204);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      res = await request(app)
        .delete(files[0])
        .expect(204);
    });

    it('should 404', async () => {
      res = await request(app)
        .delete(basePath)
        .expect(404);
    });
  });
});
