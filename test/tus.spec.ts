/* eslint-disable @typescript-eslint/camelcase */
import * as chai from 'chai';
import * as fs from 'fs';
import { app, storage } from './server';
import chaiHttp = require('chai-http');
import { serializeMetadata } from '../src';
chai.use(chaiHttp);
const expect = chai.expect;
const TEST_FILE_PATH = `${__dirname}/testfile.mp4`;

const metadata = {
  name: 'testfile.mp4',
  size: fs.statSync(TEST_FILE_PATH).size,
  mimeType: 'video/mp4',
  lastModified: 1546300800
};
const TOKEN = 'userId';

describe('::Tus', function() {
  const files: string[] = [];
  let res: ChaiHttp.Response;
  before(function() {
    storage.delete({ userId: TOKEN });
    storage.delete({ userId: null });
  });

  beforeEach(function() {
    res = undefined as any;
  });

  describe('POST', function() {
    it('should 200', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .set('Content-Type', 'application/offset+octet-stream')
        .set('Upload-Metadata', serializeMetadata(metadata))
        .set('Upload-Length', metadata.size.toString())
        .set('Tus-Resumable', '1.0.0')
        .send(fs.readFileSync(TEST_FILE_PATH));
      expect(res).to.have.status(200);
      expect(res).to.have.header('location');
      files.push(res.header.location);
    });
  });

  describe('HEAD', function() {
    it('should 204', async function() {
      res = await chai
        .request(app)
        .head(files[0])
        .set('authorization', TOKEN)
        .set('Tus-Resumable', '1.0.0');
      expect(res).to.have.status(204);
      expect(res).to.have.header('upload-offset');
      expect(res).to.have.header('upload-metadata');
      expect(res).to.have.header('tus-resumable');
    });
  });

  after(function() {
    storage.delete({ userId: TOKEN });
  });
});
