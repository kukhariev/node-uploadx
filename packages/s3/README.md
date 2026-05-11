# @uploadx/s3

S3 storage provider for [node-uploadx](https://github.com/kukhariev/node-uploadx).

## Installation

```bash
npm install @uploadx/s3
```

## Usage (Express)

```ts
import express from 'express';
import { uploadx } from '@uploadx/core';
import { S3Storage } from '@uploadx/s3';

const app = express();

const storage = new S3Storage({
  bucket: 'my-bucket',
  maxUploadSize: '512MB',
  allowMIME: ['image/*', 'video/*']
});

app.use('/files', uploadx({ storage }));

app.listen(process.env.PORT || 3002, () => console.log('Server started'));
```

## Package-Specific Options

| Option               | Type              | Description                                                |
| -------------------- | ----------------- | ---------------------------------------------------------- |
| `bucket`             | `string`          | S3 bucket name (env: `S3_BUCKET`, default: 'node-uploadx') |
| `partSize`           | `string\|number`  | Part size for multipart uploads (min 5MB, default: '16MB') |
| `acl`                | `ObjectCannedACL` | ACL settings for uploaded objects                          |
| `clientDirectUpload` | `boolean`         | Force client to upload directly to S3 via presigned URLs   |
| `keyFile`            | `string`          | Path to shared credentials file (deprecated)               |

See `@uploadx/core` and [AWS SDK S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/s3client.html) for additional options.

## Environment Variables

- `S3_BUCKET` — S3 bucket name
- `S3_ENDPOINT` — S3 endpoint URL
- `S3_FORCE_PATH_STYLE` — Force path-style addressing (for S3-compatible storage)
- `S3_REGION` — Region
- `S3_KEYFILE` — Shared credentials file
- `S3_DEBUG` — Enable S3 client logging (optional, for development)

Standard AWS SDK credential providers are also supported, for example:

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- `AWS_SHARED_CREDENTIALS_FILE`
- `AWS_CONFIG_FILE`
- `AWS_PROFILE`
- `AWS_REGION`

See [AWS SDK credentials docs](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).

### Example `.env`

```bash
S3_BUCKET=uploadx
S3_ENDPOINT=https://s3.us-west-002.backblazeb2.com
S3_FORCE_PATH_STYLE=true
S3_KEYFILE=.s3-config
```

## Full Documentation

See the main [node-uploadx](https://github.com/kukhariev/node-uploadx#readme) repository for complete documentation.

## License

MIT
