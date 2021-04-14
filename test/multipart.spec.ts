/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { join } from 'path';
import * as request from 'supertest';
import { multipart } from '../packages/core/src';
import { root, storageOptions } from './fixtures';
import { app } from './fixtures/app';
import { metadata, srcpath } from './fixtures/testfile';
import rimraf = require('rimraf');

describe('::Multipart', () => {
  let res: request.Response;
  const files: string[] = [];
  const basePath = '/multipart';
  const directory = join(root, 'multipart');
  const opts = { ...storageOptions, directory };
  app.use(basePath, multipart(opts));

  beforeAll(() => rimraf.sync(directory));
  afterAll(() => rimraf.sync(directory));

  test('wrapper', () => {
    expect(multipart()).toBeInstanceOf(Function);
  });

  describe('POST', () => {
    it('should support custom fields', async () => {
      res = await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .field('custom', 'customfield')
        .attach('file', srcpath, 'customfield')
        .expect(200);
      expect(res.body.size).toBeDefined();
      expect(res.header['location']).toBeDefined();
      files.push(res.header.location);
    });

    it('should support json metadata', async () => {
      expect.assertions(2);
      res = await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .field('metadata', JSON.stringify(metadata))
        .attach('file', srcpath, metadata.name)
        .expect(200);
      expect(res.body.size).toBeDefined();
      expect(res.header['location']).toBeDefined();
    });

    it('should 403 (unsupported filetype)', async () => {
      await request(app)
        .post(basePath)
        .set('Content-Type', 'multipart/formdata')
        .attach('file', 'package.json', metadata.name)
        .expect(403)
        .catch(() => {});
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      res = await request(app).options(basePath).expect(204);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      res = await request(app).delete(files[0]).expect(204);
    });

    it('should 404', async () => {
      res = await request(app).delete(basePath).expect(404);
    });
  });
});
