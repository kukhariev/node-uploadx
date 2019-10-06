import { expect } from 'chai';
import * as fs from 'fs';
import * as rimraf from 'rimraf';
import * as utils from '../src/core/utils';
const ROOT = `./upload/fs-test`;
const DIR = `${ROOT}/1/2`;
const FILE = `${DIR}/3/file.ext`;

describe('fs ensure*', function() {
  beforeEach(function() {
    rimraf.sync(ROOT);
  });
  it('should create directory `ensureDir()`', async function() {
    await utils.ensureDir(DIR);
    expect(fs.existsSync(DIR)).to.be.true;
  });
  it('should create file or/end return size `ensureFile()`', async function() {
    const size = await utils.ensureFile(FILE);
    expect(fs.existsSync(FILE)).to.be.true;
    expect(size).to.be.equal(0);
  });

  after(function() {
    rimraf.sync(ROOT);
  });
});

describe('typeis', function() {
  const mime = 'application/vnd+json';
  const headers = { headers: { 'content-type': mime } } as any;
  it('typeis()', function() {
    expect(utils.typeis({ headers: {} } as any, ['json'])).to.be.false;
    expect(utils.typeis(headers, ['html'])).to.be.false;
    expect(utils.typeis(headers, ['json'])).to.be.equal(mime);
  });
  it('typeis.is()', function() {
    expect(utils.typeis.is(mime, ['application/vnd+json'])).to.be.equal(mime);
    expect(utils.typeis.is(mime, ['vnd+json'])).to.be.equal(mime);
    expect(utils.typeis.is(mime, ['application/*'])).to.be.equal(mime);
    expect(utils.typeis.is(mime, ['json', 'xml'])).to.be.equal(mime);
    expect(utils.typeis.is(mime, ['*/*'])).to.be.equal(mime);
  });
});
describe('cp', function() {
  const personal = { id: '6cc438637901', timestamp: 1546300800, userId: 'c6e26eec' } as any;
  const shared = { id: 'e405e6d94f59', timestamp: 1514764800, userId: null } as any;
  // const compare = (v: number): boolean => v > 1527811200;
  it('should return `true`', function() {
    expect(utils.cp(personal, { id: '6cc438637901' })).to.be.true;
    expect(utils.cp(personal, { id: '' })).to.be.true;
    expect(utils.cp(personal, { id: '6cc438637901', userId: 'c6e26eec' })).to.be.true;
    expect(utils.cp(personal, { userId: 'c6e26eec' })).to.be.true;
    expect(utils.cp(shared, { userId: null })).to.be.true;
    expect(utils.cp(shared, {})).to.be.true;
    // expect(utils.cp(personal, { timestamp: compare })).to.be.true;
  });
  it('should return `false`', function() {
    expect(utils.cp(personal, { id: '1234' })).to.be.false;
    expect(utils.cp(personal, { id: '6cc438637901', userId: null })).to.be.false;
    // expect(utils.cp(shared, { timestamp: compare })).to.be.false;
  });
});
