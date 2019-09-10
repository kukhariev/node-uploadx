import { expect } from 'chai';
import { parseMetadata } from '../src/Tus';
describe('metadata parser', function() {
  it('should parse', function() {
    const sample =
      'name dGl0bGUubXA0,mimeType dmlkZW8vbXA0,size ODM4NjkyNTM=,lastModified MTQzNzM5MDEzODIzMQ==';
    const res = parseMetadata(sample);
    expect(res).to.eql({
      name: 'title.mp4',
      mimeType: 'video/mp4',
      size: '83869253',
      lastModified: '1437390138231'
    });
  });
  it('should parse', function() {
    const sample =
      'name dGl0bGUubXA0,mimeType dmlkZW8vbXA0,size ODM4NjkyNTM=,lastModified MTQzNzM5MDEzODIzMQ==';
    const res = parseMetadata(sample);
    expect(res).to.eql({
      name: 'title.mp4',
      mimeType: 'video/mp4',
      size: '83869253',
      lastModified: '1437390138231'
    });
  });
});
