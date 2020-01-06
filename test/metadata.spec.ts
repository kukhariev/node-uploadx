import { parseMetadata } from '../src';
describe('metadata parser', function() {
  it('should return empty object', function() {
    const sample = '';
    const res = parseMetadata(sample);
    expect(res).toEqual({});
  });

  it('should parse single key', function() {
    const sample = 'name dGl0bGUubXA0';
    const res = parseMetadata(sample);
    expect(res).toEqual({
      name: 'title.mp4'
    });
  });

  it('should parse multiple keys', function() {
    const sample =
      'name dGl0bGUubXA0,mimeType dmlkZW8vbXA0,size ODM4NjkyNTM=,lastModified MTQzNzM5MDEzODIzMQ==';
    const res = parseMetadata(sample);
    expect(res).toEqual({
      name: 'title.mp4',
      mimeType: 'video/mp4',
      size: '83869253',
      lastModified: '1437390138231'
    });
  });
});
