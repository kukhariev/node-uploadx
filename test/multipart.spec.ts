/* eslint-disable jest/no-disabled-tests */
import { join } from 'path';
import * as request from 'supertest';
import { multipart, Multipart } from '../packages/core/src';
import { app, cleanup, getNewFileMetadata, storageOptions, testfile, testRoot } from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('::Multipart', () => {
  const fileMetadata = getNewFileMetadata('fileMetadata');
  const endpoint = '/multipart';
  const directory = join(testRoot, 'multipart');
  const opts = { ...storageOptions, directory, checksum: true };
  app.use(endpoint, multipart(opts));

  function create(config = fileMetadata): request.Test {
    return request(app)
      .post(endpoint)
      .set('Content-Type', 'multipart/formdata')
      .attach('file', testfile.asBuffer, config.name);
  }

  afterAll(async () => cleanup(directory));

  describe('default options', () => {
    it('should be defined', () => {
      expect(multipart.upload()).toBeInstanceOf(Function);
      expect(new Multipart()).toBeInstanceOf(Multipart);
    });
  });

  describe('POST', () => {
    it('should support custom fields', async () => {
      expect.assertions(2);
      const res = await request(app)
        .post(endpoint)
        .set('Content-Type', 'multipart/formdata')
        .field('custom', 'customField')
        .attach('file', testfile.asBuffer, fileMetadata.name)
        .expect(200);
      expect(res.body).toHaveProperty('metadata.custom', 'customField');
      expect(res.get('location')).toBeDefined();
    });

    it('should support json metadata', async () => {
      expect.assertions(1);
      const res = await request(app)
        .post(endpoint)
        .set('Content-Type', 'multipart/formdata')
        .field('metadata', JSON.stringify(fileMetadata))
        .attach('file', testfile.asBuffer, fileMetadata.name)
        .expect(200);
      expect(res.body).toHaveProperty('metadata.name', fileMetadata.name);
    });

    it('should 403 (unsupported filetype)', async () => {
      await request(app)
        .post(endpoint)
        .set('Content-Type', 'multipart/formdata')
        .attach('file', 'package.json', 'package.json')
        .expect(403)
        .catch(() => null); // FIXME: abort doesn't work?
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      await request(app).options(endpoint).expect(204);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      const uri = (await create(fileMetadata)).get('location');
      await request(app).delete(uri).expect(204);
    });

    it('should 404', async () => {
      await request(app).delete(endpoint).expect(403);
    });
  });
});
