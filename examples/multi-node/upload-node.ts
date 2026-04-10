/**
 * Multi-Node Upload Server (Local Development)
 *
 * For production: runs on separate machines with shared NFS mount.
 * For local testing: multiple nodes write to same directory.
 *
 * Local Usage:
 *   NODE_ID=1 PORT=3000 tsx upload-node.ts
 *   NODE_ID=2 PORT=3001 tsx upload-node.ts
 *
 * Production (on each machine):
 *   mount -t nfs nfs-server:/exports/uploads /mnt/uploads
 *   NFS_ENABLED=true tsx upload-node.ts
 */

import * as process from 'node:process';
import express from 'express';
import { uploadx, logger } from '@uploadx/core';
import { getClusterStorageConfig } from './storage-config';

const NODE_ID = parseInt(process.env.NODE_ID || '1', 10);
const PORT = parseInt(process.env.PORT || '3000', 10);

// Cluster ports
const NODE1_PORT = 3000;
const NODE2_PORT = 3001;

// Shared storage config (same for all nodes)
const storageConfig = getClusterStorageConfig(NODE_ID);

const app = express();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    nodeId: NODE_ID,
    uptime: process.uptime(),
    directory: storageConfig.directory
  });
});

app.use(
  '/files',
  uploadx({
    ...storageConfig
  })
);

app.listen(PORT, () => {
  logger.info('');
  logger.info('═══════════════════════════════════════════');
  logger.info('[Node%d] listening on port %d', NODE_ID, PORT);
  logger.info('═══════════════════════════════════════════');
  logger.info('  Node 1:  http://localhost:%d/files', NODE1_PORT);
  logger.info('  Node 2:  http://localhost:%d/files', NODE2_PORT);
  logger.info('  Uploads: %s', storageConfig.directory);
  logger.info('═══════════════════════════════════════════');
  logger.info('');
});
