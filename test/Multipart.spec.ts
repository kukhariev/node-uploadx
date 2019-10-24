/* eslint-disable @typescript-eslint/camelcase */
import * as chai from 'chai';
import * as fs from 'fs';
import { app, storage } from './server';
import chaiHttp = require('chai-http');
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

describe('::Multipart', function() {
  let res: ChaiHttp.Response;
  before(function() {
    storage.delete({ userId: TOKEN });
    storage.delete({ userId: null });
  });

  beforeEach(function() {
    res = undefined as any;
  });

  describe('POST', function() {
    it('should 201 (no metadata)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .set('Content-Type', 'multipart/formdata')
        .attach('file', TEST_FILE_PATH, metadata.name);
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
    });
    it('should 201 (metadata)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .set('Content-Type', 'multipart/formdata')
        .field('metadata', JSON.stringify(metadata))
        .attach('file', TEST_FILE_PATH, metadata.name);
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
    });
    it('should 403 (unsupported filetype)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .set('Content-Type', 'multipart/formdata')
        .attach('file', 'package.json', metadata.name);
      expect(res).to.have.status(403);
    });
    after(function() {
      storage.delete({ userId: TOKEN });
    });
  });
});
