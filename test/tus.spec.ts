/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as fs from 'fs';
import { join } from 'path';
import * as request from 'supertest';
import { parseMetadata, serializeMetadata, tus, TUS_RESUMABLE } from '../packages/core/src';
import { app, cleanup, metadata, srcpath, storageOptions, uploadRoot } from './shared';

describe('::Tus', () => {
  let uri = '';
  const basePath = '/tus';
  const directory = join(uploadRoot, 'tus');
  const opts = { ...storageOptions, directory };
  app.use(basePath, tus(opts));

  function create(): request.Test {
    return request(app)
      .post(basePath)
      .set('Upload-Metadata', serializeMetadata(metadata))
      .set('Upload-Length', metadata.size.toString())
      .set('Tus-Resumable', TUS_RESUMABLE);
  }

  beforeAll(async () => cleanup(directory));

  afterAll(async () => cleanup(directory));

  describe('POST', () => {
    it('should 201', async () => {
      const res = await create().expect('tus-resumable', TUS_RESUMABLE);
      uri = res.header.location as string;
      expect(uri).toEqual(expect.stringContaining('/tus'));
    });
  });

  describe('PATCH', () => {
    it('should 204 and Upload-Offset', async () => {
      uri ||= (await create()).header.location;
      await request(app)
        .patch(uri)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Offset', '0')
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(204)
        .expect('tus-resumable', TUS_RESUMABLE)
        .expect('upload-offset', '0');
    });

    it('should 200', async () => {
      uri ||= (await create()).header.location;
      await request(app)
        .patch(uri)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Metadata', serializeMetadata(metadata))
        .set('Upload-Offset', '0')
        .set('Tus-Resumable', TUS_RESUMABLE)
        .send(fs.readFileSync(srcpath))
        .expect(200)
        .expect('tus-resumable', TUS_RESUMABLE)
        .expect('upload-offset', metadata.size.toString());
    });
  });

  describe('HEAD', () => {
    it('should 204', async () => {
      uri ||= (await create()).header.location;
      await request(app)
        .head(uri)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(200)
        .expect('upload-offset', /\d*/)
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
      uri ||= (await create()).header.location;
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
      expect(res.header.location).toEqual(expect.stringContaining('/tus'));
    });
  });

  describe('metadata parser', () => {
    it('should return empty object', () => {
      const sample = '';
      expect(parseMetadata(sample)).toEqual({});
    });

    it('should parse single key/value', () => {
      const sample = 'name dGl0bGUubXA0';
      expect(parseMetadata(sample)).toEqual({ name: 'title.mp4' });
    });

    it('should parse empty value', () => {
      const sample = 'is_ok';
      expect(parseMetadata(sample)).toEqual({ is_ok: '' });
    });

    it('should parse multiple keys', () => {
      const sample =
        'name dGl0bGUubXA0,mimeType dmlkZW8vbXA0,size ODM4NjkyNTM=,lastModified MTQzNzM5MDEzODIzMQ==,is_ok';
      expect(parseMetadata(sample)).toEqual({
        name: 'title.mp4',
        mimeType: 'video/mp4',
        size: '83869253',
        lastModified: '1437390138231',
        is_ok: ''
      });
    });
  });
});
