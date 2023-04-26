/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import fs from 'fs';
import { join } from 'path';
import request from 'supertest';
import { DiskStorage, uploadx, Uploadx } from '../packages/core/src';
import { app, cleanup, metadata, storageOptions, testfile, testRoot, userId } from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('::Uploadx', () => {
  const file1 = { ...metadata };
  const file2 = { ...metadata, name: 'testfile2.mp4' };
  const path1 = '/uploadx';
  const path2 = '/uploadx2';
  const directory = join(testRoot, 'uploadx');
  const opts = { ...storageOptions, directory, maxMetadataSize: 250 };
  const uploadx2 = new Uploadx({
    storage: new DiskStorage({
      ...storageOptions,
      onCreate: () => 'created',
      onUpdate: () => 'updated',
      onComplete: () => 'completed',
      onError: ({ statusCode, body }) => {
        const errors = [{ status: statusCode, title: body?.code, detail: body?.message }];
        return {
          statusCode,
          headers: { 'Content-Type': 'application/vnd.api+json' },
          body: { errors }
        };
      }
    })
  });
  app.use(path1, uploadx(opts));
  app.use(path2, uploadx2.handle);
  function exposedHeaders(response: request.Response): string[] {
    return response
      .get('Access-Control-Expose-Headers')
      .split(',')
      .map(s => s.toLowerCase());
  }
  function create(file: typeof metadata): request.Test {
    return request(app)
      .post(path1)
      .set('x-upload-content-type', file.mimeType)
      .set('x-upload-content-length', String(file.size))
      .send(file);
  }

  beforeEach(async () => cleanup(directory));

  afterEach(async () => cleanup(directory));

  describe('default options', () => {
    it('should be defined', () => {
      expect(uploadx.upload()).toBeInstanceOf(Function);
      expect(new Uploadx()).toBeInstanceOf(Uploadx);
    });
  });

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

    it('should ignore not json body', async () => {
      const res = await request(app).post(path1).send(new Array(500).join('c')).expect(201);
      expect(res.header).toHaveProperty('location');
    });

    it('should check filename', async () => {
      const res = await create({ ...file1, name: '../ghost' }).expect(400);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should 201 (x-headers)', async () => {
      const res = await create(file1).expect(201).expect('x-upload-expires', /.*/);
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['location', 'x-upload-expires']));
      expect(res.headers.location).toBeDefined();
    });

    it('should 201 (metadata)', async () => {
      const res = await request(app)
        .post(path1)
        .send(file2)
        .expect(201)
        .expect('x-upload-expires', /.*/);
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['location', 'x-upload-expires']));
      expect(res.header.location).toBeDefined();
    });

    it('should 201 (query)', async () => {
      await request(app)
        .post(path1)
        .send('')
        .query(file1)
        .expect(201)
        .expect('Access-Control-Expose-Headers', /.*/);
    });
  });

  describe('PATCH', () => {
    it('update metadata and originalName', async () => {
      const uri = (await create(file2)).header.location as string;
      const res = await request(app)
        .patch(uri)
        .send({ metadata: { name: 'newname.mp4' } })
        .expect(200);
      expect(res.body.metadata.name).toBe('newname.mp4');
      expect(res.body.originalName).toBe('newname.mp4');
    });

    it('set non metadata', async () => {
      const uri = (await create(file2)).header.location as string;
      const res = await request(app)
        .patch(uri)
        .send({ custom: { property: 'updated' } })
        .expect(200);
      expect(res.body.custom.property).toBe('updated');
    });
  });

  describe('PUT', () => {
    it('should 200 (simple request)', async () => {
      const uri = (await create(file2)).header.location as string;
      const res = await request(app)
        .put(uri)
        .set('Digest', `sha=${metadata.sha1}`)
        .send(testfile.asBuffer)
        .expect(200);
      expect(res.type).toBe('application/json');
      expect(fs.statSync(join(directory, userId, file2.name)).size).toBe(file2.size);
    });

    it('should 200 (chunks)', async () => {
      const uri = (await create(file1)).header.location as string;
      function uploadChunks(): Promise<request.Response> {
        return new Promise(resolve => {
          let start = 0;
          const readable = testfile.asReadable;
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          readable.on('data', async (chunk: { length: number }) => {
            readable.pause();
            const res = await request(app)
              .put(uri)
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

    it('should 308 (chunk)', async () => {
      let res = await create({ ...file2, size: 15, name: 'chunk.308' });
      const uri = res.header.location as string;
      const chunk = '12345';
      res = await request(app)
        .put(uri)
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', 'bytes 0-4/15')
        .send(chunk)
        .expect(308)
        .expect('range', 'bytes=0-4');
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['range', 'x-upload-expires']));
      res = await request(app)
        .put(uri)
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', 'bytes */*')
        .send()
        .expect(308)
        .expect('range', 'bytes=0-4');
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['range', 'x-upload-expires']));
    });

    it('should 409 (invalid range)', async () => {
      const res = await create({ ...file2, size: 15, name: 'range.409' });
      await request(app)
        .put(res.header.location as string)
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', 'bytes 13-18/70')
        .send('12345')
        .expect(409);
    });

    it('should 400 (invalid checksum algorithm)', async () => {
      const res = await create({ ...file2, name: 'invalid checksum' });
      await request(app)
        .put(res.header.location as string)
        .set('Digest', 'crc=798797')
        .send(testfile.asBuffer)
        .expect(400);
    });

    it('should 409 (invalid size)', async () => {
      const res = await create({ ...file2, size: 15, name: 'size.409' });
      await request(app)
        .put(res.header.location as string)
        .send(testfile.asBuffer)
        .expect(409);
    });

    it('should 403 (no id)', async () => {
      await request(app).put(path1).send(testfile.asBuffer).expect(403);
    });

    it('should stream', async () => {
      let res = await request(app).post(path1).send({ name: 'stream' });
      const uri = res.header.location as string;
      await request(app).put(uri).redirects(0).set('content-range', 'bytes 0-5/*').send('012345');
      res = await request(app)
        .put(uri)
        .redirects(0)
        .set('content-range', 'bytes 6-9/10')
        .send('6789');
      expect(res.status).toBe(200);
      expect(res.body.size).toBe(10);
    });
  });

  describe('GET', () => {
    it('should return info array', async () => {
      await create(file1);
      await create(file2);
      const res = await request(app).get(`${path1}`).expect(200);
      expect(res.body.items).toHaveLength(2);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      const uri = (await create(file2)).header.location as string;
      await request(app).delete(uri).expect(204);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      await request(app).options(path1).expect(204);
    });
  });

  describe('onCreate', () => {
    it('should return custom response', async () => {
      const res = await request(app).post(path2).send(file1);
      expect(res.text).toBe('created');
    });
  });

  describe('onUpdate', () => {
    it('should return custom response', async () => {
      const uri = (await request(app).post(path2).send(file1)).header.location as string;
      const res = await request(app).patch(uri).send({ custom: true });
      expect(res.text).toBe('updated');
    });
  });

  describe('onComplete', () => {
    it('should return custom response', async () => {
      const uri = (await request(app).post(path2).send(file1)).header.location as string;
      const res = await request(app).put(uri).send(testfile.asBuffer);
      expect(res.text).toBe('completed');
    });
  });

  describe('onError', () => {
    it('should return custom error response', async () => {
      const res = await request(app)
        .post(path2)
        .send({ ...file2, size: 10e10 });
      expect(res.status).toBe(413);
      expect(res.body).toMatchObject({
        errors: [
          {
            detail: 'Request entity too large',
            status: 413,
            title: 'RequestEntityTooLarge'
          }
        ]
      });
      expect(res.type).toBe('application/vnd.api+json');
    });
  });

  describe('events', () => {
    it('should emit `created`', async () => {
      let event;
      uploadx2.on('created', evt => (event = evt));
      await request(app).post(path2).send(file2).expect(201);
      expect(event).toHaveProperty('request.method', 'POST');
      expect(event).toHaveProperty('status', 'created');
    });

    it('should emit `error`', async () => {
      let event;
      uploadx2.on('error', evt => (event = evt));
      await request(app)
        .post(path2)
        .send({ ...file2, size: 10e10 })
        .expect(413);
      expect(event).toHaveProperty('request.method', 'POST');
      expect(event).toHaveProperty('code', 'RequestEntityTooLarge');
    });
  });
});
