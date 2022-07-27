import { readFile } from 'fs/promises';
import { join } from 'path';
import * as request from 'supertest';
import { DiskFile, DiskStorage, uploadx, Uploadx } from '../packages/core/src';
import {
  app,
  base64toHex,
  cleanup,
  getNewFileMetadata,
  storageOptions,
  testfile,
  testRoot
} from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('::Uploadx', () => {
  let fileMetadata = getNewFileMetadata('fileMetadata');
  const directory = join(testRoot, 'uploadx');
  const opts = { ...storageOptions, directory, maxMetadataSize: 250 };
  const uploadx2 = new Uploadx({ storage: new DiskStorage(opts) });
  const endpoint1 = '/uploadx';
  const endpoint2 = '/uploadx2';
  const endpoint3 = '/uploadx3';
  app.use(endpoint1, uploadx(opts));
  app.use(endpoint2, uploadx2.handle);
  app.use(endpoint3, uploadx({ ...opts, checksum: 'sha1' }));

  function exposedHeaders(response: request.Response): string[] {
    return response
      .get('Access-Control-Expose-Headers')
      .split(',')
      .map(s => s.toLowerCase());
  }

  function create(config = fileMetadata, url = endpoint1): request.Test {
    return request(app)
      .post(url)
      .set('x-upload-content-type', config.mimeType)
      .set('x-upload-content-length', String(config.size))
      .send(config);
  }

  function uploadChunks(url: string): Promise<request.Response> {
    return new Promise(resolve => {
      let pos = 0;
      const readable = testfile.asReadable;
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      readable.on('data', async (chunk: { length: number }) => {
        readable.pause();
        const res = await request(app)
          .put(url)
          .redirects(0)
          .set('content-type', 'application/octet-stream')
          .set('content-range', `bytes ${pos}-${pos + chunk.length - 1}/${fileMetadata.size}`)
          .send(chunk);
        res.status === 200 && resolve(res);
        pos += chunk.length;
        readable.resume();
      });
    });
  }

  beforeEach(async () => {
    await cleanup(directory);
    fileMetadata = getNewFileMetadata();
  });

  describe('default options', () => {
    it('should be defined', () => {
      expect(uploadx.upload()).toBeInstanceOf(Function);
      expect(new Uploadx()).toBeInstanceOf(Uploadx);
    });
  });

  describe('POST', () => {
    it('should 413 (size limit)', async () => {
      const res = await create({ ...fileMetadata, size: 10e10 }).expect(413);
      expect(res.type).toBe('application/json');
      expect(res.headers).not.toHaveProperty('location');
    });

    it('should 415 (unsupported filetype)', async () => {
      const res = await create({ ...fileMetadata, mimeType: 'text/json' }).expect(415);
      expect(res.type).toBe('application/json');
      expect(res.headers).not.toHaveProperty('location');
    });

    it('should check metadata size', async () => {
      const res = await create({ ...fileMetadata, custom: new Array(255).join('c') }).expect(400);
      expect(res.type).toBe('application/json');
      expect(res.headers).not.toHaveProperty('location');
    });

    it('should ignore not json body', async () => {
      const res = await request(app).post(endpoint1).send(new Array(500).join('c')).expect(201);
      expect(res.headers).toHaveProperty('location');
    });

    it('should check filename', async () => {
      const res = await create({ ...fileMetadata, name: '../ghost' }).expect(400);
      expect(res.type).toBe('application/json');
      expect(res.header).not.toHaveProperty('location');
    });

    it('should 201 (x-headers)', async () => {
      const res = await create(fileMetadata).expect(201).expect('x-upload-expires', /.*/);
      const uri = res.get('location');
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['location', 'x-upload-expires']));
      expect(uri).toBeDefined();
    });

    it('should 201 (metadata)', async () => {
      const res = await request(app)
        .post(endpoint1)
        .send(fileMetadata)
        .expect(201)
        .expect('x-upload-expires', /.*/);
      const uri = res.get('location');
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['location', 'x-upload-expires']));
      expect(uri).toBeDefined();
    });

    it('should 201 (query)', async () => {
      await request(app)
        .post(endpoint1)
        .send('')
        .query(fileMetadata)
        .expect(201)
        .expect('Access-Control-Expose-Headers', /.*/);
    });
  });

  describe('PATCH', () => {
    it('update metadata', async () => {
      const uri = (await create(fileMetadata)).get('location');
      const res = await request(app).patch(uri).send({ name: 'newname.mp4' }).expect(200);
      expect(res.body).toHaveProperty('name', 'newname.mp4');
    });
  });

  describe('PUT', () => {
    it('should 200 (simple request)', async () => {
      const uri = (await create(fileMetadata)).get('location');
      const res = await request(app)
        .put(uri)
        .set('Digest', `sha=${fileMetadata.sha1}`)
        .send(testfile.asBuffer)
        .expect(200);
      expect(res.type).toBe('application/json');
      const file = join(directory, (res.body as DiskFile).name);
      expect(await readFile(file)).toEqual(testfile.asBuffer);
    });

    it('should 200 (chunks)', async () => {
      const uri = (await create(fileMetadata)).get('location');
      const res = await uploadChunks(uri);
      expect(res.type).toBe('application/json');
      const file = join(directory, (res.body as DiskFile).name);
      expect(await readFile(file)).toEqual(testfile.asBuffer);
    });

    it('should 308 (chunk)', async () => {
      let res = await create(fileMetadata);
      const uri = res.get('location');
      res = await request(app)
        .put(uri)
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', `bytes 0-4/64`)
        .send('01234')
        .expect(308)
        .expect('range', 'bytes=0-4');
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['range', 'x-upload-expires']));
      res = await request(app)
        .put(uri)
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', `bytes */*`)
        .send()
        .expect(308)
        .expect('range', 'bytes=0-4');
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['range', 'x-upload-expires']));
    });

    it('should 409 (invalid range)', async () => {
      const res = await create(fileMetadata);
      await request(app)
        .put(res.get('location'))
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', `bytes 13-18/70`)
        .send('12345')
        .expect(409);
    });

    it('should 400 (invalid checksum algorithm)', async () => {
      const res = await create(fileMetadata);
      await request(app)
        .put(res.get('location'))
        .set('Digest', 'crc=798797')
        .send(testfile.asBuffer)
        .expect(400);
    });

    it('should 409 (invalid size)', async () => {
      const res = await create({ ...fileMetadata, size: 15 });
      await request(app).put(res.get('location')).send(testfile.asBuffer).expect(409);
    });

    it('should 403 (no id)', async () => {
      await request(app).put(endpoint1).send(testfile.asBuffer).expect(403);
    });

    it('should stream', async () => {
      const uri = (
        await request(app)
          .post(endpoint1)
          .send({ ...fileMetadata, size: undefined })
      ).get('location');
      await request(app).put(uri).redirects(0).set('content-range', `bytes 0-5/*`).send('012345');
      const res = await request(app)
        .put(uri)
        .redirects(0)
        .set('content-range', `bytes 6-9/10`)
        .send('6789');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('size', 10);
    });
  });

  describe('PUT(checksum)', () => {
    it('should have the correct checksum on complete', async () => {
      const uri = (await create(fileMetadata, endpoint3)).get('location');
      const res = await uploadChunks(uri);
      expect(res.type).toBe('application/json');
      expect(res.body).toHaveProperty('sha1', base64toHex(fileMetadata.sha1));
    });

    it('should send range checksum', async () => {
      const uri = (await create(fileMetadata, endpoint3)).get('location');
      await request(app)
        .put(uri)
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', `bytes 0-4/64`)
        .send('01234')
        .expect('x-range-sha1', /.*/);
      const res = await request(app)
        .put(uri)
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', `bytes */*`)
        .send()
        .expect(308)
        .expect('range', 'bytes=0-4')
        .expect('x-range-sha1', /.*/);
      expect(exposedHeaders(res)).toEqual(expect.arrayContaining(['range', 'x-range-sha1']));
    });
  });

  describe('GET', () => {
    it('should return info array', async () => {
      await create({ ...fileMetadata, name: 'number.one' });
      await create({ ...fileMetadata, name: 'number.two' });
      const res = await request(app).get(`${endpoint1}`).expect(200);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(res.body.items).toHaveLength(2);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      const uri = (await create(fileMetadata)).get('location');
      await request(app).delete(uri).expect(204);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      await request(app).options(endpoint1).expect(204);
    });
  });

  describe('events', () => {
    it('should emit `created`', async () => {
      let event;
      uploadx2.on('created', evt => (event = evt));
      await request(app).post(endpoint2).send(fileMetadata).expect(201);
      expect(event).toHaveProperty('request.method', 'POST');
      expect(event).toHaveProperty('status', 'created');
    });

    it('should emit `error`', async () => {
      let event;
      uploadx2.on('error', evt => (event = evt));
      await request(app)
        .post(endpoint2)
        .send({ ...fileMetadata, size: 10e10 })
        .expect(413);
      expect(event).toHaveProperty('request.method', 'POST');
      expect(event).toHaveProperty('code', 'RequestEntityTooLarge');
    });
  });
});
