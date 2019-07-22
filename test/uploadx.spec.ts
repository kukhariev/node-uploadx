process.env.NODE_ENV = 'testing';
import * as chai from 'chai';
import * as fs from 'fs';
import 'mocha';
import { Server } from 'net';
import { URL } from 'url';

import chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

describe('UploadX', () => {
  let id: string;
  let res: any;
  let start: number;
  let end: number;
  let server: Server;
  const CHUNK_SIZE = 1024 * 64;
  const TEST_FILE_PATH = `${__dirname}/testfile.mp4`;
  const TEST_FILE_SIZE = fs.statSync(TEST_FILE_PATH).size;
  function getIdFromRequest(res: any) {
    const loc = new URL(res['headers']['location'], 'http://localhost');
    return loc.searchParams.get('upload_id') as string;
  }

  before(() => {
    server = require('./server').server;
  });

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

  after(function() {
    server && server.close();
  });
});
