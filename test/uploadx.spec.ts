/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as fs from 'fs';
import { join } from 'path';
import * as request from 'supertest';
import { uploadx } from '../packages/core/src';
import { app, cleanup, metadata, srcpath, storageOptions, uploadRoot, userId } from './shared';

describe('::Uploadx', () => {
  const file1 = { ...metadata };
  const file2 = { ...metadata, name: 'testfile2.mp4' };
  let uri1 = '';
  let uri2 = '';
  let start: number;
  const basePath = '/uploadx';
  const directory = join(uploadRoot, 'uploadx');
  const opts = { ...storageOptions, directory, maxMetadataSize: 250 };
  app.use(basePath, uploadx(opts));

  function create(file: typeof metadata): request.Test {
    return request(app)
      .post(basePath)
      .set('x-upload-content-type', file.mimeType)
      .set('x-upload-content-length', String(file.size))
      .send(file);
  }

  beforeAll(async () => cleanup(directory));

  afterAll(async () => cleanup(directory));

  describe('POST', () => {
    it('should 413 (size limit)', async () => {
      const res = await create({ ...file1, size: 10e10 }).expect(413);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should 415 (unsupported filetype)', async () => {
      const res = await create({ ...file1, mimeType: 'text/json' }).expect(415);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should check metadata size', async () => {
      const res = await create({ ...file1, custom: new Array(255).join('c') }).expect(400);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should check filename', async () => {
      const res = await create({ ...file1, name: '../ghost' }).expect(400);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should 201 (x-headers)', async () => {
      const res = await create(file1).expect(201).expect('x-upload-expires', /.*/);
      uri1 = res.header.location as string;
      expect(uri1).toBeDefined();
    });

    it('should 201 (metadata)', async () => {
      const res = await request(app)
        .post(basePath)
        .send(file2)
        .expect(201)
        .expect('x-upload-expires', /.*/);
      uri2 = res.header.location as string;
      expect(uri2).toBeDefined();
    });

    it('should 201 (query)', async () => {
      await request(app).post(basePath).send('').query(file1).expect(201);
    });
  });

  describe('PATCH', () => {
    it('update metadata', async () => {
      uri2 ||= (await create(file2)).header.location;
      const res = await request(app).patch(uri2).send({ name: 'newname.mp4' }).expect(200);
      expect(res.body.name).toBe('newname.mp4');
    });
  });

  describe('PUT', () => {
    it('should 200 (chunks)', async () => {
      uri1 ||= (await create(file1)).header.location;

      function uploadChunks(): Promise<request.Response> {
        return new Promise(resolve => {
          start = 0;
          const readable = fs.createReadStream(srcpath);
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          readable.on('data', async (chunk: { length: number }) => {
            readable.pause();
            const res = await request(app)
              .put(uri1)
              .redirects(0)
              .set('content-type', 'application/octet-stream')
              .set('content-range', `bytes ${start}-${start + chunk.length - 1}/${metadata.size}`)
              .send(chunk);
            res.status === 200 && resolve(res);
            start += chunk.length;
            readable.resume();
          });
        });
      }

      const res = await uploadChunks();
      expect(res.type).toBe('application/json');
      expect(fs.statSync(join(directory, userId, file1.name)).size).toBe(file1.size);
    });

    it('should 200 (single request)', async () => {
      uri2 ||= (await create(file2)).header.location;
      const res = await request(app).put(uri2).send(fs.readFileSync(srcpath)).expect(200);
      expect(res.type).toBe('application/json');
      expect(fs.statSync(join(directory, userId, file2.name)).size).toBe(file2.size);
    });

    it('should 409 (invalid size)', async () => {
      const res = await create({ ...file2, size: 5 });
      await request(app)
        .put(res.header.location as string)
        .send(fs.readFileSync(srcpath))
        .expect(409);
    });

    it('should 403 (no id)', async () => {
      await request(app).put(basePath).send(fs.readFileSync(srcpath)).expect(403);
    });

    it('should stream', async () => {
      let res = await request(app).post(basePath).send({ name: 'stream' });
      const streamUri = res.header.location as string;
      await request(app)
        .put(streamUri)
        .redirects(0)
        .set('content-range', `bytes 0-5/*`)
        .send('012345');
      res = await request(app)
        .put(streamUri)
        .redirects(0)
        .set('content-range', `bytes 6-9/10`)
        .send('6789');
      expect(res.status).toBe(200);
      expect(res.body.size).toBe(10);
    });
  });

  describe('GET', () => {
    it('should return info array', async () => {
      uri1 ||= (await create(file1)).header.location;
      uri2 ||= (await create(file2)).header.location;
      const res = await request(app).get(`${basePath}`).expect(200);
      expect(res.body.items.length).toBeGreaterThan(2);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      uri2 ||= (await create(file2)).header.location;
      await request(app).delete(uri2).expect(204);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      await request(app).options(basePath).expect(204);
    });
  });
});
