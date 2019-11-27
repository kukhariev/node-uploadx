/* eslint-disable @typescript-eslint/camelcase */
import * as chai from 'chai';
import * as fs from 'fs';
import { app, storage, UPLOADS_DIR } from './server';
import chaiHttp = require('chai-http');
import rimraf = require('rimraf');
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

describe('::Uploadx', function() {
  let res: ChaiHttp.Response;
  let start: number;
  const files: string[] = [];
  before(function() {
    rimraf.sync(UPLOADS_DIR);
  });
  beforeEach(function() {
    res = undefined as any;
  });
  describe('POST', function() {
    it('should 403 (size limit)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', (10e10).toString())
        .send({ name: 'file.mp4' });

      expect(res).to.be.json;
      expect(res).to.have.status(403);
      expect(res).to.not.have.header('location');
    });
    it('should 403 (unsupported filetype)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .set('x-upload-content-type', 'text/json')
        .set('x-upload-content-length', '3000')
        .send({ name: 'file.json' });
      expect(res).to.be.json;
      expect(res).to.have.status(403);
      expect(res).to.not.have.header('location');
    });
    it('should 400 (bad request)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .send('');
      expect(res).to.have.status(400);
    });
    it('should 201 (x-upload-content)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', metadata.size.toString())
        .send({ name: 'testfile.mp4' });
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
      files.push(res.header.location);
    });
    it('should 201 (metadata)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', TOKEN)
        .send({ ...metadata, name: 'testfileSingle.mp4' });
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
      files.push(res.header.location);
    });
  });
  describe('PUT', function() {
    it('should 200 (chunks)', function(done) {
      console.log(files);

      start = 0;
      const readable = fs.createReadStream(TEST_FILE_PATH);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      readable.on('data', async chunk => {
        readable.pause();
        res = await chai
          .request(app)
          .put(files[0])
          .redirects(0)
          .set('authorization', TOKEN)
          .set('content-type', 'application/octet-stream')
          .set('content-range', `bytes ${start}-${start + chunk.length - 1}/${metadata.size}`)
          .send(chunk);
        start += chunk.length;
        if (res.status === 200) {
          expect(res).to.be.json;
          expect(fs.statSync(`${UPLOADS_DIR}${TOKEN}/testfile.mp4`).size).to.be.eql(metadata.size);
          done();
        }
        readable.resume();
      });
    });

    it('should 200 (single request)', async function() {
      res = await chai
        .request(app)
        .put(files[1])
        .set('authorization', TOKEN)
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(TEST_FILE_PATH));
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(fs.statSync(`${UPLOADS_DIR}${TOKEN}/testfileSingle.mp4`).size).to.be.eql(
        metadata.size
      );
    });
    it('should 404 (no id)', async function() {
      res = await chai
        .request(app)
        .put('/upload')
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(TEST_FILE_PATH));
      expect(res).to.be.json;
      expect(res).to.have.status(404);
    });
  });
  describe('GET', function() {
    it('should return files array', async function() {
      res = await chai
        .request(app)
        .get(`/upload`)
        .set('authorization', TOKEN);
      expect(res).to.be.json;
      expect(res.body).to.have.lengthOf(2);
      expect(res).to.have.status(200);
    });
  });
  describe('DELETE', function() {
    it('should 204', async function() {
      res = await chai
        .request(app)
        .delete(files[1])
        .set('authorization', TOKEN);
      expect(res).to.have.status(204);
    });
  });

  describe('OPTIONS', function() {
    it('should 204', async function() {
      res = await chai.request(app).options('/upload');
      expect(res).to.have.status(204);
    });
  });
  after(function() {
    storage.delete(TOKEN);
  });
});
