/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as fs from 'fs';
import { vol } from 'memfs';

import { Readable } from 'node:stream';
import { DiskStorage } from '../packages/core/src';
import { FilePart } from '../packages/core/src/storages/file';

jest.mock('fs/promises');
jest.mock('fs');

const TEST_DIR = 'test-uploads';
const META_DIR = `${TEST_DIR}/.uploadx`;

describe('DiskStorage - Parallel Upload Test', () => {
  let storage: DiskStorage;
  let fileId: string;
  const fileName = 'parallel-test.bin';
  const fileSize = 50 * 1024 * 1024; // 50 MB
  const chunkCount = 5;
  const chunkSize = fileSize / chunkCount;

  const chunks: Array<{ part: FilePart; buffer: Buffer }> = [];

  function generatePatternBuffer(size: number): Buffer {
    const buffer = Buffer.alloc(size);
    const wordsCount = Math.floor(size / 4);
    for (let i = 0; i < wordsCount; i++) {
      buffer.writeUInt32LE(i, i * 4);
    }
    return buffer;
  }

  let originalData: Buffer;

  beforeAll(async () => {
    vol.reset();
    await fs.promises.mkdir(META_DIR, { recursive: true });

    storage = new DiskStorage({
      directory: TEST_DIR,
      metaStorageConfig: { directory: META_DIR }
    });

    const fileInit = {
      originalName: fileName,
      size: fileSize,
      metadata: {}
    };

    const file = await storage.create({} as any, fileInit);
    fileId = file.id;
    originalData = generatePatternBuffer(fileSize);

    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const buffer = originalData.slice(start, start + chunkSize);

      chunks.push({
        part: {
          id: fileId,
          name: fileId,
          size: fileSize,
          start,
          contentLength: buffer.length,
          body: Readable.from(buffer)
        },
        buffer
      });
    }
  }, 30000);

  it('should check metafile', async () => {
    const metafile = await storage.getMeta(fileId);
    expect(metafile.id).toBe(fileId);
    expect(metafile.bytesWritten).toBe(0);
  });

  it('should upload chunks in parallel and complete on the last one', async () => {
    const allButLast = chunks.slice(0, -1);
    const lastChunk = chunks[chunks.length - 1];

    const shuffledChunks = [...allButLast].sort(() => Math.random() - 0.5);

    await Promise.all(shuffledChunks.map(({ part }) => storage.write(part)));

    await storage.write(lastChunk.part);

    const meta = await storage.getMeta(fileId);
    expect(meta.status).toBe('completed');
    expect(meta.bytesWritten).toBe(fileSize);

    const filePath = storage.getFilePath(fileId);
    const diskData = await fs.promises.readFile(filePath);
    expect(Buffer.compare(diskData, originalData)).toBe(0);
  }, 60000);

  afterAll(async () => {
    try {
      await storage.delete({ id: fileId });
    } catch (err) {
      // Ignore deletion errors
    } finally {
      vol.reset();
    }
  });
});
