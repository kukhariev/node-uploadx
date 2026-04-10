/**
 * Multi-Node Storage Configuration (Local Development)
 *
 * For production: mount NFS share to the same path on all nodes.
 * For local testing: all nodes use the same directory (simulating NFS).
 *
 * Production NFS Setup:
 *   mount -t nfs nfs-server:/exports/uploads /mnt/uploads
 *
 * Local Testing:
 *   All nodes write to ./uploads (same directory, like NFS mount).
 */

import { LogLevel, DiskStorageOptions } from '@uploadx/core';

/**
 * Storage path configuration.
 *
 * Production: All nodes use the SAME NFS mount point.
 * Local testing: All nodes use the SAME directory (simulating NFS).
 */
function getStorageDirectory(): string {
  // NFS mount (production)
  if (process.env.NFS_ENABLED === 'true') {
    return process.env.NFS_MOUNTT_POINT || '/mnt/uploads';
  }

  // Local testing: shared directory (all nodes write here)
  return process.env.UPLOAD_DIR || './uploads';
}

/**
 * Uploadx storage configuration for cluster.
 *
 * All nodes use the SAME directory (NFS in production, local dir in testing).
 */
export function getClusterStorageConfig(_nodeId?: number): DiskStorageOptions {
  const baseDir = getStorageDirectory();

  return {
    // All nodes use the same directory (NFS in production, local dir in testing)
    directory: baseDir,

    // Metadata in same directory (on NFS in production)
    metaStorageConfig: {
      directory: `${baseDir}/.meta`,
      prefix: '.'
    },

    maxUploadSize: '20GB',
    allowMIME: ['video/*', 'image/*', 'application/*'],
    useRelativeLocation: true,

    // Expiration - cleanup handled externally (cron or single node)
    expiration: {
      maxAge: '1h',
      // Disable built-in purge
      purgeInterval: 0
    },

    logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',

    onComplete: file => {
      console.log('[onComplete]', file.name, file.size);
      return file;
    },

    onError: error => {
      console.error('[onError]', error);
      return {
        statusCode: 500,
        body: { error: 'Upload failed' }
      };
    }
  };
}
