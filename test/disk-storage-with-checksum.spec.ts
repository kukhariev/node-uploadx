import { DiskStorageWithChecksum } from '../packages/core/src';
import { authRequest, metafile, storageOptions } from './shared';
import { Readable } from 'stream';

const directory = 'ds-test';

jest.mock('fs/promises');
jest.mock('fs');

describe('DiskStorageWithChecksum', () => {
  jest.useFakeTimers({ doNotFake: ['setTimeout'] }).setSystemTime(new Date('2022-02-02'));
  const options = { ...storageOptions, directory, checksum: 'sha1' as const };
  const req = authRequest();

  it('should support checksum resume from fs', async () => {
    let storage = new DiskStorageWithChecksum(options);
    let diskFile = await storage.create(req, { ...metafile });
    await storage.write({ ...diskFile, start: 0, body: Readable.from('01234') });
    storage = new DiskStorageWithChecksum(options);
    diskFile = await storage.create(req, { ...metafile });
    diskFile = await storage.write({ ...diskFile, start: 5, body: Readable.from('56789') });
    expect(diskFile).toMatchSnapshot();
  });
});
