const { createServer } = require('http');
const { DiskStorage, Uploadx } = require('@uploadx/core');

const PORT = process.env.PORT || 3002;

const storage = new DiskStorage({
  uploadDir: process.env.UPLOAD_DIR || 'upload',
  basePath: '/files',
  maxFileSize: '5GB',
  allowedMimeTypes: ['video/*', 'image/*']
});

const uploadx = new Uploadx({ storage });

uploadx.on('error', error => console.error('error: ', error));
uploadx.on('created', ({ originalName }) => console.log('created: ', originalName));
uploadx.on('part', ({ originalName }) => console.log('part: ', originalName));
uploadx.on('deleted', ({ originalName }) => console.log('deleted: ', originalName));
uploadx.on('completed', file => console.log('completed: ', file));
uploadx.on('updated', file => console.log(' metadata updated: ', file));

const server = createServer((req, res) => {
  uploadx.handle(req, res);
});

server.listen(+PORT, () => console.log('listening on port:', PORT));
