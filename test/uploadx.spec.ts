process.env.NODE_ENV = 'testing';
const { URL } = require('url');
import chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-http'));
import { server } from './server';
import { readFileSync, statSync, open, read, close, unlinkSync } from 'fs';
const CHUNK_SIZE = 1024 * 64;
const TEST_FILE_PATH = `${__dirname}/testfile.mp4`;
const TEST_FILE_SIZE = statSync(TEST_FILE_PATH).size;

function xopen(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    open(path, 'r', (err, fd) => {
      err ? reject(err) : resolve(fd);
    });
  });
}
function nextChunk(fd: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.alloc(CHUNK_SIZE);
    read(fd, buffer, 0, CHUNK_SIZE, undefined, (err, bytesRead, buffer) => {
      if (err) {
        reject(err);
      }
      if (bytesRead < CHUNK_SIZE) {
        close(fd, err => {
          if (err) {
            reject(err);
          }
        });
      }
      const data: Buffer =
        bytesRead < CHUNK_SIZE ? buffer.slice(0, bytesRead) : buffer;
      resolve(data);
    });
  });
}

/*  */
describe('UploadX', () => {
  let id: string;
  let res: ChaiHttp.Response;
  describe('API', () => {
    it('should bypass on non-uploadx requests', async () => {
      try {
        res = await chai
          .request(server)
          .post('/upload/v1')
          .query({ uploadType: 'resumable' })
          .set('authorization', 'Bearer ToKeN')
          .send({ name: 'testfile2.mp4' });
      } finally {
        expect(res).to.have.status(200);
      }
    });
    it('should return 401 error without auth headers', async () => {
      try {
        res = await chai
          .request(server)
          .post('/upload/v1')
          .set('x-upload-content-type', 'video/mp4')
          .set('x-upload-content-length', `${Number.MAX_SAFE_INTEGER}`);
      } finally {
        expect(res).to.have.status(401);
        expect(res).to.not.have.header('location');
      }
    });
    it('should return 413 error on very big file', async () => {
      try {
        res = await chai
          .request(server)
          .post('/upload/v1')
          .set('authorization', 'Bearer ToKeN')
          .set('x-upload-content-type', 'video/mp4')
          .set('x-upload-content-length', `${Number.MAX_SAFE_INTEGER}`)
          .send({ name: 'testfile2.mp4' });
      } finally {
        expect(res).to.have.status(413);
        expect(res).to.not.have.header('location');
      }
    });
    it('POST request should create new session', async () => {
      try {
        res = await chai
          .request(server)
          .post('/upload/v1')
          .query({ uploadType: 'resumable' })
          .set('authorization', 'Bearer ToKeN')
          .set('x-upload-content-type', 'video/mp4')
          .set('x-upload-content-length', `${TEST_FILE_SIZE}`)
          .send({ name: 'testfile2.mp4' });
      } finally {
        expect(res).to.have.status(201);
        expect(res).to.have.header('location');
        const loc = new URL(res['headers']['location']);
        id = loc.searchParams.get('upload_id');
        console.log('id =', id);
      }
    });
    it('PUT request should save file', async () => {
      try {
        res = await chai
          .request(server)
          .put(`/upload/v1?upload_id=${id}`)
          .send(readFileSync(TEST_FILE_PATH))
          .set('content-type', 'video/mp4');
      } finally {
        expect(statSync(res.body.path).size).to.be.eql(TEST_FILE_SIZE);
        expect(res).to.have.status(200);
        unlinkSync('/tmp/' + id);
      }
    });
    it('should create other session', async () => {
      try {
        res = await chai
          .request(server)
          .post('/upload/v1')
          .query({ uploadType: 'resumable' })
          .set('authorization', 'Bearer ToKeN')
          .set('x-upload-content-type', 'video/mp4')
          .set('x-upload-content-length', `${TEST_FILE_SIZE}`)
          .send({ name: 'dummy.mp4' });
      } finally {
        expect(res).to.have.status(201);
        expect(res).to.have.header('location');
        const loc = new URL(res['headers']['location']);
        id = loc.searchParams.get('upload_id');
      }
    });
    it('should list user sessions', async () => {
      try {
        res = await chai
          .request(server)
          .get('/upload/v1')
          .set('authorization', 'Bearer ToKeN');
      } finally {
        expect(res.body).instanceof(Array);
        expect(res).to.have.status(200);
      }
    });
    it('should remove session', async () => {
      try {
        res = await chai
          .request(server)
          .del(`/upload/v1?upload_id=${id}`)
          .set('authorization', 'Bearer ToKeN');
      } finally {
        console.log(res.text);
        expect(res).to.have.status(204);
      }
    });
    it('should remove fault', async () => {
      try {
        res = await chai
          .request(server)
          .del('/upload/v1')
          .set('authorization', 'Bearer ToKeN');
      } finally {
        expect(res).to.have.status(400);
      }
    });
  });
  describe('Chunks', () => {
    it('should create session', async () => {
      try {
        res = await chai
          .request(server)
          .post('/upload/v1')
          .query({ uploadType: 'resumable' })
          .set('authorization', 'Bearer ToKeN')
          .set('x-upload-content-type', 'video/mp4')
          .set('x-upload-content-length', `${TEST_FILE_SIZE}`);
      } finally {
        expect(res).to.have.status(201);
        expect(res).to.have.header('location');
        [, id] = res['headers']['location'].split('/upload/v1?upload_id=');
        try {
          unlinkSync('/tmp/' + id);
        } catch {}
      }
    });
    it('should save', async () => {
      let done = false;
      let start = 0;
      const fd = await xopen(TEST_FILE_PATH);
      const size = TEST_FILE_SIZE;
      while (!done) {
        const end = start + CHUNK_SIZE > size ? size : start + CHUNK_SIZE;
        const chunk = await nextChunk(fd);
        res = await chai
          .request(server)
          .put(`/upload/v1?upload_id=${id}`)
          .redirects(0)
          .send(chunk)
          .set('content-type', 'video/mp4')
          .set('content-range', `bytes ${start}-${end - 1}/${size}`);
        done = chunk.length < CHUNK_SIZE || res.status === 200;
        start = start + CHUNK_SIZE;
      }
      expect(statSync('/tmp/' + id).size).to.be.eql(TEST_FILE_SIZE);
      unlinkSync('/tmp/' + id);
    });
  });
  describe('Destination', () => {
    let filepath: string;
    it('should create session', async () => {
      try {
        res = await chai
          .request(server)
          .post('/upload/v2')
          .set('authorization', 'Bearer ToKeN')
          .set('x-upload-content-type', 'video/mp4')
          .set('x-upload-content-length', `${TEST_FILE_SIZE}`)
          .send({ name: 'testfile.mp4' });
      } finally {
        expect(res).to.have.status(201);
        expect(res).to.have.header('location');
        const loc = new URL(res['headers']['location']);
        id = loc.searchParams.get('upload_id');
      }
    });
    it('should save', async () => {
      try {
        res = await chai
          .request(server)
          .put(`/upload/v2?upload_id=${id}`)
          .send(readFileSync(TEST_FILE_PATH))
          .set('content-type', 'video/mp4');
      } finally {
        filepath = res.body.path;
        expect(res).to.have.status(200);
        expect(statSync(filepath).size).to.be.eql(TEST_FILE_SIZE);
        unlinkSync(filepath);
      }
    });
  });
});
