import * as utils from '../packages/core/src';

describe('fromEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should read env vars without prefix (default)', () => {
    process.env['BASE_URL'] = 'https://example.com';
    process.env['UPLOAD_DIR'] = '/uploads';
    process.env['MAX_FILE_SIZE'] = '10MB';
    const result = utils.fromEnv();
    expect(result).toEqual({
      baseUrl: 'https://example.com',
      uploadDir: '/uploads',
      maxFileSize: '10MB'
    });
  });

  it('should read custom prefix', () => {
    process.env['MY_APP_BASE_URL'] = 'https://custom.com';
    process.env['MY_APP_UPLOAD_DIR'] = '/data';
    const result = utils.fromEnv('MY_APP_');
    expect(result).toEqual({
      baseUrl: 'https://custom.com',
      uploadDir: '/data'
    });
  });

  it('should return empty object when no env vars', () => {
    const result = utils.fromEnv();
    expect(result).toEqual({});
  });

  it('should parse ALLOWED_MIME_TYPES as array', () => {
    process.env['ALLOWED_MIME_TYPES'] = 'image/png,  image/jpeg ,  video/mp4';
    const result = utils.fromEnv();
    expect(result).toEqual({
      allowedMimeTypes: ['image/png', 'image/jpeg', 'video/mp4']
    });
  });
});
