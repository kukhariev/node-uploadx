/* eslint-disable @typescript-eslint/camelcase */
import * as chai from 'chai';
import * as fs from 'fs';
import { URL } from 'url';
import { app, storage } from '../app';
import chaiHttp = require('chai-http');

chai.use(chaiHttp);
const expect = chai.expect;
const TEST_FILE_PATH = `${__dirname}/../testfile.mp4`;
const TEST_FILE_SIZE = fs.statSync(TEST_FILE_PATH).size;
const getId = (res: ChaiHttp.Response) => {
  const location = new URL(res.header.location, 'http://localhost');
  return location.searchParams.get('upload_id') || '';
};
describe('uploadx', () => {
  let id: string;
  let res: ChaiHttp.Response;
  let start: number;

  before(() => {
    storage.reset();
  });

  beforeEach(() => {
    res = undefined as any;
  });
  describe('limits', () => {
    it('size', async () => {
      try {
        res = await chai
          .request(app)
          .post('/upload')
          .set('authorization', 'Bearer ToKeN')
          .set('x-upload-content-type', 'video/mp4')
          .set('x-upload-content-length', `${Number.MAX_SAFE_INTEGER}`)
          .send({ name: 'testfile2.mp4' });
      } finally {
        expect(res).to.be.json;
        expect(res).to.have.status(403);
        expect(res).to.not.have.header('location');
      }
    });
    it('filetype', async () => {
      try {
        res = await chai
          .request(app)
          .post('/upload')
          .set('authorization', 'Bearer ToKeN')
          .set('x-upload-content-type', 'text/json')
          .set('x-upload-content-length', '3000')
          .send({ name: 'testfile2.json' });
      } finally {
        expect(res).to.be.json;
        expect(res).to.have.status(403);
        expect(res).to.not.have.header('location');
      }
    });
  });

  it('create(x-headers)', async () => {
    try {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', 'Bearer ToKeN')
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', `${TEST_FILE_SIZE}`)
        .send({ name: 'testfile.mp4' });
    } finally {
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
      id = getId(res);
      expect(id.length).to.gt(1);
    }
  });

  it('multiple chunks', done => {
    start = 0;
    const readable = fs.createReadStream(TEST_FILE_PATH);
    readable.on('data', async chunk => {
      readable.pause();
      res = await chai
        .request(app)
        .put(`/upload`)
        .query({ upload_id: id })
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', `bytes ${start}-${start + chunk.length - 1}/${TEST_FILE_SIZE}`)
        .send(chunk);
      start += chunk.length;

      if (res.status === 200) {
        expect(res).to.be.json;
        expect(fs.statSync(res.body.path).size).to.be.eql(TEST_FILE_SIZE);
        done();
      }
      readable.resume();
    });
  });

  it('get files', async () => {
    try {
      res = await chai.request(app).get(`/upload`);
    } finally {
      expect(res).to.be.json;
      expect(res).to.have.status(200);
    }
  });

  it('delete', async () => {
    try {
      res = await chai
        .request(app)
        .delete(`/upload`)
        .query({ upload_id: id });
    } finally {
      expect(res.body).to.have.property('name');
      expect(res).to.have.status(200);
    }
  });

  it('create(metadata)', async () => {
    try {
      res = await chai
        .request(app)
        .post('/upload')
        .set('authorization', 'Bearer ToKeN')
        .send({ name: 'testfileSingle.mp4', mimeType: 'video/mp4', size: TEST_FILE_SIZE });
    } finally {
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
      id = getId(res);
      expect(id.length).to.gt(1);
    }
  });
  it('single request', async () => {
    try {
      res = await chai
        .request(app)
        .put(`/upload`)
        .query({ upload_id: id })
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(TEST_FILE_PATH));
    } finally {
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(fs.statSync(res.body.path).size).to.be.eql(TEST_FILE_SIZE);
      fs.unlinkSync(res.body.path);
    }
  });

  after(function() {
    storage.reset();
  });
});
