import * as chai from 'chai';
import { app, storage, userId } from './server';
import { metadata, srcpath } from './server/testfile';
import chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

describe('::Multipart', function() {
  let res: ChaiHttp.Response;

  beforeEach(function() {
    res = undefined as any;
  });

  describe('POST', function() {
    it('should 201 (no metadata)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('Content-Type', 'multipart/formdata')
        .attach('file', srcpath, metadata.name);
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
    });

    it('should 201 (metadata)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('Content-Type', 'multipart/formdata')
        .field('metadata', JSON.stringify(metadata))
        .attach('file', srcpath, metadata.name);
      expect(res).to.have.status(201);
      expect(res).to.have.header('location');
    });

    it('should 403 (unsupported filetype)', async function() {
      res = await chai
        .request(app)
        .post('/upload')
        .set('Content-Type', 'multipart/formdata')
        .attach('file', 'package.json', metadata.name);
      expect(res).to.have.status(403);
    });

    afterAll(async function() {
      await storage.delete(userId);
    });
  });
});
