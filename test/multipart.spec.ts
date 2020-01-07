import * as chai from 'chai';
import { app, storage, userId } from './server';
import { metadata, srcpath } from './server/testfile';
import chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

describe('::Multipart', () => {
  let res: ChaiHttp.Response;

  beforeEach(() => {
    res = undefined as any;
  });

  describe('POST', () => {
    it('should 201 (no metadata)', async () => {
      res = await chai
        .request(app)
        .post('/upload')
        .set('Content-Type', 'multipart/formdata')
        .attach('file', srcpath, metadata.name);
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
    });

    it('should 201 (metadata)', async () => {
      res = await chai
        .request(app)
        .post('/upload')
        .set('Content-Type', 'multipart/formdata')
        .field('metadata', JSON.stringify(metadata))
        .attach('file', srcpath, metadata.name);
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
    });

    it('should 403 (unsupported filetype)', async () => {
      res = await chai
        .request(app)
        .post('/upload')
        .set('Content-Type', 'multipart/formdata')
        .attach('file', 'package.json', metadata.name);
      expect(res).to.have.status(403);
    });

    afterAll(async () => {
      await storage.delete(userId);
    });
  });
});
