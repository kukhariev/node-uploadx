# Examples

This directory contains working examples demonstrating various use cases of `node-uploadx`.

## Running Examples

From the repository root, install dependencies and build `node-uploadx` packages first:

```bash
npm install
npm run build
```

Then navigate to the examples directory and run the desired script:

```bash
# Basic Express example
npm run basic

# Express with default storage (local filesystem)
npm run express

# Express with S3 storage
npm run s3

# Express with GCS storage
npm run gcs

# Plain Node.js server combining Uploadx, TUS and Multipart protocols
npm run server

# Plain Node.js HTTP server example
npm run plain-nodejs

# Other examples...
npm run tus
npm run validation
npm run redis
npm run logtape
npm run custom-error-responses
npm run express-polling
```

## Example Descriptions

| File                                                     | Description                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| [`express.ts`](express.ts)                               | Express example with authentication and logging                     |
| [`express-basic.ts`](express-basic.ts)                   | Minimal Express setup with local file storage                       |
| [`express-s3.ts`](express-s3.ts)                         | Upload to AWS S3                                                    |
| [`express-gcs.ts`](express-gcs.ts)                       | Upload to Google Cloud Storage                                      |
| [`express-tus.ts`](express-tus.ts)                       | Using the tus resumable upload protocol                             |
| [`express-polling.ts`](express-polling.ts)               | Polling-based upload implementation                                 |
| [`express-redis.ts`](express-redis.ts)                   | Using Redis for metadata storage                                    |
| [`express-logtape.ts`](express-logtape.ts)               | Logging with LogTape                                                |
| [`custom-error-responses.ts`](custom-error-responses.ts) | Custom error handling and responses                                 |
| [`validation.ts`](validation.ts)                         | File validation (type, size, custom rules)                          |
| [`s3-direct.ts`](s3-direct.ts)                           | Direct S3 upload                                                    |
| [`gcs-direct.ts`](gcs-direct.ts)                         | Direct GCS upload                                                   |
| [`node-http-server.js`](node-http-server.js)             | Plain Node.js HTTP server example                                   |
| [`server.js`](server.js)                                 | Plain Node.js server combining Uploadx, TUS and Multipart protocols |

## Prerequisites

Most examples require environment variables. Copy `.env.example` to `.env` and fill in the values:

```env
# Required for all examples
UPLOAD_DIR=./files

# For S3 examples (aws s3, minio, etc.)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET=your-bucket

# For GCS examples
GCS_BUCKET=your-bucket
GCS_KEY_FILE=/path/to/key.json

# Optional
UPLOADX_SECRET=your-secret-key
```

See `.env.example` for full environment variable reference.
