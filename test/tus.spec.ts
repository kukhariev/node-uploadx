/* eslint-disable @typescript-eslint/camelcase */
import * as chai from 'chai';
import * as fs from 'fs';
import { serializeMetadata } from '../src/handlers/tus';
import { app, metadata, srcpath, storage, userId } from './server';
import chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

describe('::Tus', () => {
  const files: string[] = [];
  let res: ChaiHttp.Response;

  beforeEach(() => {
    res = undefined as any;
  });

  describe('POST', () => {
    it('should 200', async () => {
      res = await chai
        .request(app)
        .post('/upload')
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Metadata', serializeMetadata(metadata))
        .set('Upload-Length', metadata.size.toString())
        .set('Tus-Resumable', '1.0.0')
        .send(fs.readFileSync(srcpath));
      expect(res).to.have.status(200);
      expect(res).to.have.header('location');
      files.push(res.header.location);
    });
  });

  describe('HEAD', () => {
    it('should 204', async () => {
      res = await chai
        .request(app)
        .head(files[0])
        .set('Tus-Resumable', '1.0.0');
      expect(res).to.have.status(204);
      expect(res).to.have.header('upload-offset');
      expect(res).to.have.header('upload-metadata');
      expect(res).to.have.header('tus-resumable');
    });
  });

  afterAll(async () => {
    await storage.delete(userId);
  });
});
