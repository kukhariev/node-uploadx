# Local Development Environment

Docker services for testing with cloud storage emulators.

## Quick Start

```bash
# From project root
docker compose -f .dev/docker-compose.yml up -d

# Or change directory
cd .dev
docker compose up -d
```

## Stop Services

```bash
docker compose -f .dev/docker-compose.yml down
```

## Stop and remove volumes

```bash
docker compose -f .dev/docker-compose.yml down -v
```

## Services

| Service       | Port | Description                   |
| ------------- | ---- | ----------------------------- |
| Nginx Proxy   | 8081 |                               |
| GCS Emulator  | 4443 | Google Cloud Storage emulator |
| MinIO S3      | 9000 | S3 API emulator               |
| MinIO Console | 9001 | minio web console             |

## MinIO Credentials

- **Access Key**: `minioadmin`
- **Secret Key**: `minioadmin`

## GCS Credentials

The `@uploadx/gcs` library requires real credentials even when using the emulator:

1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Select or create a project
3. Go to **IAM & Admin** → **Service Accounts**
4. Create a service account with **Storage Object Admin** role
5. Create a JSON key and save it

Set in `.dev/.env`:

```env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GCS_BUCKET=my-bucket
```

## Nginx Configuration

`nginx.conf` configures reverse proxy with CORS support (see comments in file):

- **`/gcs/`** → GCS Emulator (port 4443)
- **`/minio/`** → MinIO S3 (port 9000)

## Auto Configuration

On startup, the following buckets are created automatically:

- GCS bucket: `my-bucket`
- MinIO bucket: `my-bucket`

Customize bucket names in `.dev/.env`:

```env
GCS_BUCKET=my-bucket
S3_BUCKET=my-bucket
```

## Using with Examples

Examples in `examples/` use configuration from `.env` file.

## View Logs

```bash
docker compose -f .dev/docker-compose.yml logs -f
```
