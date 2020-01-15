/* eslint-disable @typescript-eslint/camelcase */
import * as fs from 'fs';
import { join } from 'path';
import * as request from 'supertest';
import { uploadx } from '../src/handlers/uploadx';
import { app, rm, root, storageOptions, userPrefix } from './_utils/app';
import { metadata, srcpath } from './_utils/testfile';

describe('::Uploadx', () => {
  let res: request.Response;
  const files: string[] = [];
  let start: number;
  const basePath = '/uploadx';
  const directory = join(root, 'uploadx');
  const opts = { ...storageOptions, directory };
  app.use(basePath, uploadx(opts));

  beforeAll(() => rm(directory));
  afterAll(() => rm(directory));
  beforeEach(() => (res = undefined as any));

  test('wrapper', () => {
    expect(uploadx()).toBeInstanceOf(Function);
  });

  describe('POST', () => {
    it('should 403 (size limit)', async () => {
      res = await request(app)
        .post(basePath)
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', (10e10).toString())
        .send({ name: 'file.mp4' })
        .expect(403);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should 403 (unsupported filetype)', async () => {
      res = await request(app)
        .post(basePath)
        .set('x-upload-content-type', 'text/json')
        .set('x-upload-content-length', '3000')
        .send({ name: 'file.json' })
        .expect(403);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should 400 (bad request)', async () => {
      res = await request(app)
        .post(basePath)
        .send('')
        .expect(400);
    });

    it('should 201 (x-upload-content)', async () => {
      res = await request(app)
        .post(basePath)
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', metadata.size.toString())
        .send(metadata)
        .expect(201);
      expect(res.header['location']).toBeDefined();
      files.push(res.header.location);
    });

    it('should 201 (metadata)', async () => {
      res = await request(app)
        .post(basePath)
        .send({ ...metadata, name: 'testfileSingle.mp4' })
        .expect(201);
      expect(res.header['location']).toBeDefined();
      files.push(res.header.location);
    });
  });

  describe('PATCH', () => {
    it('update metadata', async () => {
      res = await request(app)
        .patch(files[1])
        .send({ name: 'newname.mp4' })
        .expect(200);
    });
  });

  describe('PUT', () => {
    it('should 200 (chunks)', done => {
      start = 0;
      const readable = fs.createReadStream(srcpath);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      readable.on('data', async chunk => {
        readable.pause();
        res = await request(app)
          .put(files[0])
          .redirects(0)
          .set('content-type', 'application/octet-stream')
          .set('content-range', `bytes ${start}-${start + chunk.length - 1}/${metadata.size}`)
          .send(chunk);
        start += chunk.length;
        if (res.status === 200) {
          expect(res.type).toBe('application/json');
          expect(fs.statSync(join(directory, userPrefix, 'testfile.mp4')).size).toBe(metadata.size);
          done();
        }
        readable.resume();
      });
    });

    it('should 200 (single request)', async () => {
      res = await request(app)
        .put(files[1])
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(srcpath))
        .expect(200);
      expect(res.type).toBe('application/json');
      expect(fs.statSync(join(directory, userPrefix, 'testfileSingle.mp4')).size).toBe(
        metadata.size
      );
    });

    it('should 404 (no id)', async () => {
      res = await request(app)
        .put(basePath)
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(srcpath))
        .expect(404);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      res = await request(app)
        .delete(files[1])
        .expect(204);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      res = await request(app)
        .options(basePath)
        .expect(204);
    });
  });
});
