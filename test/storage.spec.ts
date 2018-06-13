import { UploadXOptions, Store } from '../src/storage';
import chai = require('chai');
const expect = chai.expect;
const storage = new Store('/tmp');
const keys = [
  'bytesWritten',
  'created',
  '_destination',
  'filename',
  'id',
  'metadata',
  'mimetype',
  'path',
  'size',
  'user'
];
const uploads: UploadXOptions[] = [
  {
    metadata: {
      name: 'file1'
    },
    user: { name: 'user656', id: '656' },
    size: 100,
    mimetype: 'video/mp4'
  },
  {
    metadata: {
      name: 'file2'
    },
    user: { name: 'user656', id: '656' },
    size: 100,
    mimetype: 'video/mp4'
  }
];
const ids = [];
describe('Storage', () => {
  before(() => {
    storage.reset();
  });
  it('should create session', () => {
    uploads.forEach(upload => {
      const result = storage.create(upload);
      ids.push(result.id);
      expect(result).to.have.keys(keys);
    });
  });
  it('should get session by id', () => {
    expect(storage.findById(ids[0])).to.have.keys(keys);
    expect(storage.findById(ids[1])).to.have.keys(keys);
  });
  it('should list all user sessions', () => {
    const result = storage.find({
      user: { name: 'user656', id: '656' },
      size: 100
    });
    expect(result).to.be.an('array');
    expect(result.length).to.be.eql(2);
    expect(result[0]).to.have.keys(keys);
  });
  it('should remove session', () => {
    storage.remove(ids[1]);
    const result = storage.find();
    expect(result).to.be.an('array');
    expect(result.length).to.be.eql(1);
    expect(result[0]).to.have.keys(keys);
  });
  it('should reset', () => {
    storage.reset();
    const result = storage.find();
    expect(result).to.be.an('array');
    expect(result.length).to.be.eql(0);
  });
});
