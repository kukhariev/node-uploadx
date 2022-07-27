import { join } from 'path';
import * as request from 'supertest';
import { parseMetadata, serializeMetadata, tus, Tus, TUS_RESUMABLE } from '../packages/core/src';
import { app, cleanup, getNewFileMetadata, storageOptions, testfile, testRoot } from './shared';

jest.mock('fs/promises');
jest.mock('fs');

describe('::Tus', () => {
  let fileMetadata = getNewFileMetadata('fileMetadata');
  const endpoint = '/tus';
  const directory = join(testRoot, 'tus');
  const opts = { ...storageOptions, directory };
  app.use(endpoint, tus(opts));

  function exposedHeaders(response: request.Response): string[] {
    return response
      .get('Access-Control-Expose-Headers')
      .split(',')
      .map(s => s.toLowerCase());
  }

  function create(config = fileMetadata, url = endpoint): request.Test {
    return request(app)
      .post(url)
      .set('Upload-Metadata', serializeMetadata(config))
      .set('Upload-Length', config.size.toString())
      .set('Tus-Resumable', TUS_RESUMABLE);
  }

  beforeEach(async () => {
    await cleanup(directory);
    fileMetadata = getNewFileMetadata();
  });

  describe('default options', () => {
    it('should be defined', () => {
      expect(tus.upload()).toBeInstanceOf(Function);
      expect(new Tus()).toBeInstanceOf(Tus);
    });
  });

  describe('POST', () => {
    it('should 201', async () => {
      const res = await create(fileMetadata).expect('tus-resumable', TUS_RESUMABLE);
      const uri = res.get('location');
      expect(uri).toEqual(expect.stringContaining('/tus'));
      expect(exposedHeaders(res)).toEqual(
        expect.arrayContaining(['location', 'upload-expires', 'tus-resumable'])
      );
    });
  });

  describe('PATCH', () => {
    it('should 204 and Upload-Offset', async () => {
      const uri = (await create(fileMetadata)).get('location');
      const res = await request(app)
        .patch(uri)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Offset', '0')
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(204)
        .expect('tus-resumable', TUS_RESUMABLE)
        .expect('upload-offset', '0')
        .expect('upload-expires', /.*/);
      expect(exposedHeaders(res)).toEqual(
        expect.arrayContaining(['upload-offset', 'upload-expires', 'tus-resumable'])
      );
    });

    it('should 200', async () => {
      const uri = (await create(fileMetadata)).get('location');
      await request(app)
        .patch(uri)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Metadata', serializeMetadata(fileMetadata))
        .set('Upload-Offset', '0')
        .set('Tus-Resumable', TUS_RESUMABLE)
        .set('Upload-Checksum', `sha1 ${fileMetadata.sha1}`)
        .send(testfile.asBuffer)
        .expect(200)
        .expect('tus-resumable', TUS_RESUMABLE)
        .expect('upload-offset', fileMetadata.size.toString())
        .expect('upload-expires', /.*/);
    });
  });

  describe('HEAD', () => {
    it('should 204', async () => {
      const uri = (await create(fileMetadata)).get('location');
      const res = await request(app)
        .head(uri)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(200)
        .expect('upload-offset', /\d*/)
        .expect('upload-metadata', /.*\S.*/)
        .expect('tus-resumable', TUS_RESUMABLE);
      expect(exposedHeaders(res)).toEqual(
        expect.arrayContaining([
          'upload-offset',
          'upload-length',
          'upload-metadata',
          'upload-expires',
          'tus-resumable'
        ])
      );
    });

    it('should 403', async () => {
      await request(app)
        .head(endpoint)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(403)
        .expect('tus-resumable', TUS_RESUMABLE);
    });
  });

  describe('OPTIONS', () => {
    it('should 204', async () => {
      const res = await request(app)
        .options(endpoint)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(204)
        .expect('tus-resumable', TUS_RESUMABLE);
      expect(exposedHeaders(res)).toEqual(
        expect.arrayContaining([
          'tus-extension',
          'tus-max-size',
          'tus-resumable',
          'tus-checksum-algorithm'
        ])
      );
    });
  });

  describe('DELETE', () => {
    it('should 204', async () => {
      const uri = (await create(fileMetadata)).get('location');
      await request(app)
        .delete(uri)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(204)
        .expect('tus-resumable', TUS_RESUMABLE);
    });

    it('should 403', async () => {
      await request(app)
        .delete(endpoint)
        .set('Tus-Resumable', TUS_RESUMABLE)
        .expect(403)
        .expect('tus-resumable', TUS_RESUMABLE);
    });
  });

  describe('POST (creation-with-upload)', () => {
    it('should return upload-offset', async () => {
      const res = await request(app)
        .post(endpoint)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Metadata', serializeMetadata(fileMetadata))
        .set('Upload-Length', fileMetadata.size.toString())
        .set('Tus-Resumable', TUS_RESUMABLE)
        .send(testfile.asBuffer.slice(0, 5))
        .expect(200)
        .expect('tus-resumable', TUS_RESUMABLE)
        .expect('upload-offset', '5')
        .expect('upload-expires', /.*/);
      expect(res.get('location')).toEqual(expect.stringContaining('/tus'));
      expect(exposedHeaders(res)).toEqual(
        expect.arrayContaining(['upload-offset', 'location', 'upload-expires', 'tus-resumable'])
      );
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
