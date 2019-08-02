import * as chai from 'chai';
import * as fs from 'fs';
import 'mocha';
import { tmpdir } from 'os';
import * as rimraf from 'rimraf';
import { ensureDir, ensureFile } from '../src/utils';
const expect = chai.expect;

const ROOT = `${tmpdir()}/uploadx`;
const DIR = `${ROOT}/1/2`;
const FILE = `${DIR}/3/file.ext`;
const REL = './tmp/1/2';

describe('util', function() {
  beforeEach(() => rimraf.sync(ROOT));

  it('should create recursive dir', async function() {
    await ensureDir(DIR);
    expect(fs.existsSync(DIR)).to.be.true;
  });
  it('should create file', async function() {
    const size = await ensureFile(FILE);
    expect(fs.existsSync(FILE)).to.be.true;
    expect(size).to.be.equal(0);
  });
  it('should create recursive dir (relative)', async function() {
    await ensureDir(REL);
    expect(fs.existsSync(REL)).to.be.true;
  });
  after(() => rimraf.sync(ROOT));
});
