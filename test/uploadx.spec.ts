process.env.NODE_ENV = 'testing';
import * as chai from 'chai';
import * as fs from 'fs';
import 'mocha';
import { URL } from 'url';
import { server } from './server';
import { reset } from './storage-reset';
import chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

const CHUNK_SIZE = 1024 * 64;
const TEST_FILE_PATH = `${__dirname}/testfile.mp4`;
const TEST_FILE_SIZE = fs.statSync(TEST_FILE_PATH).size;

function getIdFromRequest(res: any) {
  const loc = new URL(res['headers']['location'], 'http://localhost');
  return loc.searchParams.get('upload_id') as string;
}
describe('UploadX', () => {
  let id: string;
  let res: any;
  let start;
  let end;
  before(reset);
  beforeEach(() => {
    res = undefined as any;
  });
  it('fileSize limit', async () => {
    try {
      res = await chai
        .request(server)
        .post('/upload')
        .set('authorization', 'Bearer ToKeN')
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', `${Number.MAX_SAFE_INTEGER}`)
        .send({ name: 'testfile2.mp4' });
    } finally {
      expect(res).to.have.status(403);
      expect(res).to.not.have.header('location');
    }
  });
  it('create', async () => {
    try {
      res = await chai
        .request(server)
        .post('/upload')
        .query({ uploadType: 'uploadX' })
        .set('authorization', 'Bearer ToKeN')
        .set('x-upload-content-type', 'video/mp4')
        .set('x-upload-content-length', `${TEST_FILE_SIZE}`)
        .send({ name: 'testfile.mp4' });
    } finally {
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
      id = getIdFromRequest(res);
    }
  });
  it('range-error', async () => {
    try {
      res = await chai
        .request(server)
        .put(`/upload`)
        .query({ uploadType: 'uploadX', upload_id: id })
        .set('content-type', 'application/octet-stream')
        .send(fs.readFileSync(TEST_FILE_PATH));
    } finally {
      expect(res).to.have.status(400);
    }
  });
  it('chunks', done => {
    start = 0;
    const readable = fs.createReadStream(TEST_FILE_PATH);
    readable.on('data', async chunk => {
      end = start + chunk.length;
      readable.pause();
      res = await chai
        .request(server)
        .put(`/upload`)
        .query({ upload_id: id })
        .redirects(0)
        .set('content-type', 'application/octet-stream')
        .set('content-range', `bytes ${start}-${end - 1}/${TEST_FILE_SIZE}`)
        .send(chunk);
      start = end;

      if (res.status === 200) {
        expect(fs.statSync(res.body.path).size).to.be.eql(TEST_FILE_SIZE);
        done();
      }
      readable.resume();
    });
  });
  it('get files', async () => {
    try {
      res = await chai.request(server).get(`/upload`);
    } finally {
      // expect(res.body[0]).to.have.property('filename');
      expect(res).to.have.status(200);
    }
  });
  it('delete file', async () => {
    try {
      res = await chai
        .request(server)
        .delete(`/upload`)
        .query({ upload_id: id });
    } finally {
      expect(res.body).to.have.property('filename');
      expect(res).to.have.status(200);
    }
  });
});
