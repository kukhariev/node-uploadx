/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as fs from 'fs';
import { join } from 'path';
import * as request from 'supertest';
import { BaseStorage, serializeMetadata, tus, TUS_RESUMABLE } from '@uploadx/core';
import { root, storageOptions } from './fixtures';
import { app } from './fixtures/app';
import { metadata, srcpath } from './fixtures/testfile';
import { cleanup } from './fixtures/utils';

describe('::Tus', () => {
  let uri: string;
  const basePath = '/tus';
  const directory = join(root, 'tus');
  const opts = { ...storageOptions, directory };
  app.use(basePath, tus(opts));

  beforeAll(() => cleanup(directory));
  afterAll(() => cleanup(directory));

  describe('express middleware', () => {
    it('default storage', () => {
      expect(tus()).toBeInstanceOf(Function);
    });
    it('custom storage', () => {
      const storage = {} as BaseStorage<any, any>;
      expect(tus({ storage })).toBeInstanceOf(Function);
    });
  });

  describe('POST', () => {
    it('should 201', async () => {
      const res = await request(app)
        .post(basePath)
        .set('Upload-Metadata', serializeMetadata(metadata))
        .set('Upload-Length', metadata.size.toString())
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(201)
        .expect('tus-resumable', TUS_RESUMABLE);
      uri = res.header.location as string;
      expect(res.header.location).toEqual(expect.stringContaining('/tus'));
    });
  });

  describe('PATCH', () => {
    it('should 204 and Upload-Offset', async () => {
      await request(app)
        .patch(uri)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Offset', '0')
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(204)
        .expect('tus-resumable', TUS_RESUMABLE)
        .expect('upload-offset', '0');
    });

    it('should 204', async () => {
      await request(app)
        .patch(uri)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Metadata', serializeMetadata(metadata))
        .set('Upload-Offset', '0')
        .set('Tus-Resumable', TUS_RESUMABLE)
        .send(fs.readFileSync(srcpath))
        .expect(204)
        .expect('tus-resumable', TUS_RESUMABLE)
        .expect('upload-offset', metadata.size.toString());
    });
  });

  describe('HEAD', () => {
    it('should 204', async () => {
      await request(app)
        .head(uri)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(200)
        .expect('upload-offset', metadata.size.toString())
        .expect('upload-metadata', /.*\S.*/)
        .expect('tus-resumable', TUS_RESUMABLE);
    });

    it('should 404', async () => {
      await request(app)
        .head(basePath)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(404)
        .expect('tus-resumable', TUS_RESUMABLE);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      await request(app)
        .options(basePath)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(204)
        .expect('tus-resumable', TUS_RESUMABLE);
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      await request(app)
        .delete(uri)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(204)
        .expect('tus-resumable', TUS_RESUMABLE);
    });

    it('should 404', async () => {
      await request(app)
        .delete(basePath)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(404)
        .expect('tus-resumable', TUS_RESUMABLE);
    });
  });

  describe('POST (creation-with-upload)', () => {
    it('should return upload-offset', async () => {
      const res = await request(app)
        .post(basePath)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Metadata', serializeMetadata(metadata))
        .set('Upload-Length', metadata.size.toString())
        .set('Tus-Resumable', TUS_RESUMABLE)
        .send(fs.readFileSync(srcpath).slice(0, 5))
        .expect(200)
        .expect('tus-resumable', TUS_RESUMABLE)
        .expect('upload-offset', '5');
      uri = res.header.location as string;
      expect(res.header.location).toEqual(expect.stringContaining('/tus'));
    });
  });
});
