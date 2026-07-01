import type { Redis, RedisOptions } from 'ioredis';
import { File } from './file';
import { MetaStorage, MetaStorageOptions, UploadList } from './meta-storage';

/**
 * Redis connection and metadata storage options
 */
export interface RedisMetaStorageOptions extends MetaStorageOptions, RedisOptions {}

let RedisCtor: new (options?: RedisOptions) => Redis;

try {
  RedisCtor = require('ioredis') as typeof RedisCtor;
} catch {
  // ioredis is optional and may not be installed
}

/**
 * Redis-backed upload metadata storage
 * @example
 * ```ts
 * import { RedisMetaStorage, uploadx } from '@uploadx/core';
 *
 * app.use(
 *   '/files',
 *   uploadx({
 *     uploadDir: 'upload',
 *     metaStorage: new RedisMetaStorage({ host: 'localhost', port: 6379 })
 *   })
 * );
 * ```
 */
export class RedisMetaStorage<T extends File = File> extends MetaStorage<T> {
  client!: Redis;

  constructor(readonly options: RedisMetaStorageOptions = {}) {
    const { prefix = 'uploadx:meta:', suffix: _, ...redisOptions } = options;
    super({ prefix, suffix: '' });
    if (!RedisCtor) {
      throw new Error('ioredis is not installed. Install it with: npm install ioredis');
    }
    this.client = new RedisCtor(redisOptions);
    this.client.on('error', err => {
      this.logger.error('Redis connection error', { err });
    });
  }

  async save(id: string, file: T): Promise<T> {
    await this.client.hset(
      this.key(id),
      'id',
      id,
      'data',
      JSON.stringify(file),
      'createdAt',
      String(file.createdAt ?? '')
    );
    return file;
  }

  async touch(id: string, file: T): Promise<T> {
    const modifiedAt = new Date().toISOString();
    await this.client.hset(this.key(id), 'modifiedAt', modifiedAt);
    return { ...file, modifiedAt } as T;
  }

  async get(id: string): Promise<T> {
    const data = await this.client.hget(this.key(id), 'data');
    if (!data) throw new Error('Meta not found');
    return JSON.parse(data) as T;
  }

  async delete(id: string): Promise<void> {
    await this.client.del(this.key(id));
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  async list(prefix = ''): Promise<UploadList> {
    const pattern = `${this.prefix}${prefix}*`;
    const stream = this.client.scanStream({ match: pattern });
    const keys = new Set<string>();
    return new Promise<UploadList>((resolve, reject) => {
      stream.on('data', (result: string[]) => {
        for (const key of result) keys.add(key);
      });
      stream.on('end', () => {
        this.fetchItems([...keys])
          .then(items => {
            if (items.length !== keys.size) {
              this.logger.warn('Some metadata entries are missing or corrupted');
            }
            resolve({ items });
          })
          .catch(reject);
      });
      stream.on('error', reject);
    });
  }

  toString(): string {
    return `[${this.constructor.name}: ${JSON.stringify(this.options)}, prefix="${this.prefix}"]`;
  }

  private key(id: string): string {
    return `${this.prefix}${id}`;
  }

  private async fetchItems(keys: string[]): Promise<UploadList['items']> {
    if (!keys.length) return [];
    const pipeline = this.client.pipeline();
    for (const key of keys) pipeline.hmget(key, 'id', 'createdAt', 'modifiedAt');
    const execResult = (await pipeline.exec()) as [Error | null, (string | null)[]][];
    if (!execResult) return [];
    const items: UploadList['items'] = [];
    for (let i = 0; i < keys.length; i++) {
      const [error, fields] = execResult[i];
      if (error || !fields) continue;
      const [id, createdAt, modifiedAt] = fields;
      if (!id) continue;
      items.push({
        id,
        createdAt: createdAt ?? '',
        modifiedAt: modifiedAt ?? createdAt ?? ''
      });
    }
    return items;
  }
}
