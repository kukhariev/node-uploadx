# @uploadx/core

Core module for [node-uploadx](https://github.com/kukhariev/node-uploadx) - resumable upload middleware for Express and Node.js.

## Installation

```bash
npm install @uploadx/core
```

## Usage

```ts
import express from 'express';
import { uploadx } from '@uploadx/core';

const app = express();

app.use(
  '/files',
  uploadx({
    uploadDir: './uploads',
    maxFileSize: '10GB',
    onComplete: file => console.log('Upload complete:', file)
  })
);

app.listen(3000);
```

## Options

See [node-uploadx documentation](https://github.com/kukhariev/node-uploadx#readme) for complete list of options.

## License

MIT
