/* eslint-disable @typescript-eslint/camelcase */
import * as chai from 'chai';
import * as fs from 'fs';
import { app, storage } from './server';
import chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;
const TEST_FILE_PATH = `${__dirname}/testfile.mp4`;

const testFile = {
  name: 'testfile.mp4',
  src: TEST_FILE_PATH,
  size: fs.statSync(TEST_FILE_PATH).size,
  mimeType: 'video/mp4'
};
const TOKEN = 'userToken';
describe('::Uploadx', function() {
  let res: ChaiHttp.Response;
  let start: number;
  const files: any[] = [];
  before(function() {
    storage.delete({ userId: TOKEN });
  });

  beforeEach(function() {
    res = undefined as any;
  });
  describe('POST', function() {
    it('should 403 on size limit', async function() {
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
    it('should 403 on unsupported filetype', async function() {
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
    it('should 400 on bad request', async function() {
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
        .set('x-upload-content-length', testFile.size.toString())
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
        .send({ ...testFile, name: 'testfileSingle.mp4' });
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
      files.push(res.header.location);
    });
    // it('should return 200 if file exist', async function() {
    //   res = await chai
    //     .request(app)
    //     .post('/upload')
    //     .set('authorization', TOKEN)
    //     .send({ ...testFile, name: 'testfileSingle.mp4' });
    //   expect(res).to.have.status(200);
    //   expect(res).to.have.header('location');
    //   files.push(res.header.location);
    // });
  });
  describe('PUT', function() {
    it('should 200 (chunks)', function(done) {
      start = 0;
      const readable = fs.createReadStream(testFile.src);
      readable.on('data', async chunk => {
        readable.pause();
        res = await chai
          .request(app)
          .put(files[0])
          .redirects(0)
          .set('authorization', TOKEN)
          .set('content-type', 'application/octet-stream')
          .set('content-range', `bytes ${start}-${start + chunk.length - 1}/${testFile.size}`)
          .send(chunk);
        start += chunk.length;
        if (res.status === 200) {
          expect(res).to.be.json;
          expect(fs.statSync(res.body.path).size).to.be.eql(testFile.size);
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
        .send(fs.readFileSync(testFile.src));
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(fs.statSync(res.body.path).size).to.be.eql(testFile.size);
    });
    it('should 403 on user auth', async function() {
      res = await chai
        .request(app)
        .put(files[1])
        .set('authorization', 'otherUser')
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(testFile.src));
      expect(res).to.have.status(403);
    });
    it('should 404 without id', async function() {
      res = await chai
        .request(app)
        .put('/upload')
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(testFile.src));
      expect(res).to.be.json;
      expect(res).to.have.status(404);
    });
  });
  describe('GET', function() {
    it('should return empty without auth', async function() {
      res = await chai.request(app).get(`/upload`);
      expect(res).to.be.json;
      expect(res.body).to.be.empty;
      expect(res).to.have.status(200);
    });
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
    it('should 403 on user auth', async function() {
      res = await chai
        .request(app)
        .delete(files[1])
        .set('authorization', 'otherUser');
      expect(res).to.have.status(403);
    });
    it('should delete', async function() {
      res = await chai
        .request(app)
        .delete(files[1])
        .set('authorization', TOKEN);
      expect(res).to.have.status(204);
    });
  });

  describe('OPTIONS', function() {
    it('should return 404', async function() {
      res = await chai.request(app).options('/upload');
      expect(res).to.have.status(404);
    });
  });
  after(function() {
    storage.delete({ userId: TOKEN });
  });
});
