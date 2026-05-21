# @uploadx/gcs

Google Cloud Storage provider for [node-uploadx](https://github.com/kukhariev/node-uploadx).

## Installation

```bash
npm install @uploadx/gcs
```

## Usage (Express)

```ts
import express from 'express';
import { uploadx } from '@uploadx/core';
import { GCStorage } from '@uploadx/gcs';

const app = express();

const storage = new GCStorage({
  bucket: 'my-bucket',
  maxFileSize: '1GB',
  allowedMimeTypes: ['image/*', 'video/*'],
  onComplete: file => console.log('Upload complete:', file)
});

app.use('/files', uploadx({ storage }));

app.listen(process.env.PORT || 3002, () => console.log('Server started'));
```

## Package-Specific Options

| Option               | Type      | Description                                                  |
| -------------------- | --------- | ------------------------------------------------------------ |
| `bucket`             | `string`  | GCS bucket name (env: `GCS_BUCKET`, default: 'node-uploadx') |
| `keyFile`            | `string`  | Path to service account key file (env: `GCS_KEYFILE`)        |
| `clientDirectUpload` | `boolean` | Force client to upload directly to GCS via resumable URI     |

See `@uploadx/core` and [GoogleAuth](https://googleapis.dev/nodejs/google-auth-library/latest/classes/GoogleAuth.html) for additional options.

## Environment Variables

- `GCS_BUCKET` - Google Cloud Storage bucket name
- `GCS_KEYFILE` - Path to service account JSON key file
- `GCS_UPLOAD_API` - Custom upload API endpoint
- `GCS_STORAGE_API` - Custom storage API endpoint
- `STORAGE_EMULATOR_HOST` - GCS emulator host for local development

Get service account credentials from [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts).

### Example `.env`

```bash
GCS_BUCKET=node-uploadx.appspot.com
GCS_KEYFILE=~/.gcs-credentials.json
```

## Full Documentation

See the main [node-uploadx](https://github.com/kukhariev/node-uploadx#readme) repository for complete documentation.

## License

MIT
