/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as fs from 'fs';
import { join } from 'path';
import * as request from 'supertest';
import { uploadx } from '@uploadx/core';
import { root, storageOptions, userPrefix } from './fixtures';
import { app } from './fixtures/app';
import { metadata, srcpath } from './fixtures/testfile';
import rimraf = require('rimraf');

describe('::Uploadx', () => {
  const files: string[] = [];
  let start: number;
  const basePath = '/uploadx';
  const directory = join(root, 'uploadx');
  const opts = { ...storageOptions, directory };
  app.use(basePath, uploadx(opts));

  beforeAll(() => rimraf.sync(directory));
  afterAll(() => rimraf.sync(directory));

  test('wrapper', () => {
    expect(uploadx()).toBeInstanceOf(Function);
  });

  describe('POST', () => {
    it('should 413 (size limit)', async () => {
      const res = await request(app)
        .post(basePath)
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', (10e10).toString())
        .send({ name: 'file.mp4' })
        .expect(413);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should 415 (unsupported filetype)', async () => {
      const res = await request(app)
        .post(basePath)
        .set('x-upload-content-type', 'text/json')
        .set('x-upload-content-length', '3000')
        .send({ name: 'file.json' })
        .expect(415);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should 400 (bad request)', async () => {
      await request(app).post(basePath).send('').expect(400);
    });

    it('should 201 (x-upload-content)', async () => {
      const res = await request(app)
        .post(basePath)
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', metadata.size.toString())
        .send(metadata)
        .expect(201);
      expect(res.header['location']).toBeDefined();
      files.push(res.header['location']);
    });

    it('should 201 (metadata)', async () => {
      const res = await request(app)
        .post(basePath)
        .send({ ...metadata, name: 'testfileSingle.mp4' })
        .expect(201);
      expect(res.header['location']).toBeDefined();
      files.push(res.header['location']);
    });
  });

  describe('PATCH', () => {
    it('update metadata', async () => {
      const res =  await request(app).patch(files[1]).send({ name: 'newname.mp4' }).expect(200);
      expect(res.body.name).toBe('newname.mp4')
    });
  });

  describe('PUT', () => {
    it('should 200 (chunks)', done => {
      start = 0;
      const readable = fs.createReadStream(srcpath);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      readable.on('data', async (chunk: { length: number }) => {
        readable.pause();
        const res = await request(app)
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
      const res = await request(app)
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
      await request(app)
        .put(basePath)
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(srcpath))
        .expect(404);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      await request(app).delete(files[1]).expect(204);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      await request(app).options(basePath).expect(204);
    });
  });
});
