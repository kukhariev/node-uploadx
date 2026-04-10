# Multi-Node Upload Cluster

Example of running two uploadx nodes with shared storage (simulating NFS).

## Architecture

```
┌────────────┐
│  Clients   │
└─────┬──────┘
      │
┌─────▼──────┐
│ Caddy:3002 │
└─────┬──────┘
    ┌─┴─┐
    │   │
┌───▼─┐ ┌─▼───┐
│Node1│ │Node2│
│:3000│ │:3001│
└──┬──┘ └──┬──┘
   │       │
   └───┬───┘
       ▼
  ┌─────────┐
  │./uploads│
  └─────────┘
```

## Install Caddy

See [official docs](https://caddyserver.com/docs/install).

```bash
caddy version
```

## Quick Start

### 1. Install dependencies

```bash
cd G:\node-uploadx
npm install
```

### 2. Start both nodes (one window)

```bash
npm run cluster:all --workspace examples
```

### 3. Start Caddy (second window)

```bash
npm run caddy --workspace examples
```

### 4. Verify

```bash
# Via Caddy (load balanced)
curl http://localhost:3002/health

# Direct
curl http://localhost:3000/health   # Node 1
curl http://localhost:3001/health   # Node 2
```

## Files

| File                | Description                  |
| ------------------- | ---------------------------- |
| `storage-config.ts` | Shared storage configuration |
| `upload-node.ts`    | Single node server code      |
| `Caddyfile`         | Caddy load balancer config   |

## Production: NFS

```bash
mount -t nfs nfs-server:/exports/uploads /mnt/uploads
NFS_ENABLED=true tsx upload-node.ts
```
