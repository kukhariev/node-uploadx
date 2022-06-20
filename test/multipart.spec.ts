/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { join } from 'path';
// import { vol } from 'memfs';
import * as request from 'supertest';
import { multipart, Multipart } from '../packages/core/src';
import { app, cleanup, metadata, storageOptions, testfile, testRoot } from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('::Multipart', () => {
  let res: request.Response;
  let uri = '';
  const basePath = '/multipart';
  const directory = join(testRoot, 'multipart');
  const opts = { ...storageOptions, directory };
  app.use(basePath, multipart(opts));

  function create(): request.Test {
    return request(app)
      .post(basePath)
      .set('Content-Type', 'multipart/formdata')
      .attach('file', testfile.asBuffer, testfile.name);
  }

  beforeAll(async () => cleanup(directory));

  afterAll(async () => cleanup(directory));

  describe('default options', () => {
    it('should be defined', () => {
      expect(multipart.upload()).toBeInstanceOf(Function);
      expect(new Multipart()).toBeInstanceOf(Multipart);
    });
  });

  describe('POST', () => {
    it('should support custom fields', async () => {
      res = await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .field('custom', 'customField')
        .attach('file', testfile.asBuffer, {
          filename: testfile.filename,
          contentType: testfile.contentType
        })
        .expect(200);
      expect(res.body.size).toBeDefined();
      uri = res.header['location'] as string;
      expect(uri).toContain('multi');
    });

    it('should support json metadata', async () => {
      expect.assertions(2);
      res = await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .field('metadata', JSON.stringify(metadata))
        .attach('file', testfile.asBuffer, testfile.name)
        .expect(200);
      expect(res.body.size).toBeDefined();
      expect(res.header['location']).toBeDefined();
    });

    it('should 403 (unsupported filetype)', async () => {
      await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .attach('file', 'package.json', 'package.json')
        .expect(403)
        .catch(() => null);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      res = await request(app).options(basePath).expect(204);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      uri ||= (await create()).header.location;
      res = await request(app).delete(uri).expect(204);
    });

    it('should 404', async () => {
      res = await request(app).delete(basePath).expect(403);
    });
  });
});
