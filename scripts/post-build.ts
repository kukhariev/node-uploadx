import * as fs from 'fs';

try {
  const oldPackage = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }));
  const newPackage: any = {};
  newPackage.name = oldPackage.name;
  newPackage.version = oldPackage.version;
  newPackage.description = oldPackage.description;
  newPackage.keywords = oldPackage.keywords;
  newPackage.author = oldPackage.author;
  newPackage.repository = oldPackage.repository;
  newPackage.homepage = oldPackage.homepage;
  newPackage.license = oldPackage.license;
  newPackage.files = ['lib', 'types'];
  newPackage.typings = 'types/index.d.ts';
  newPackage.main = 'lib/index.js';
  newPackage.dependencies = oldPackage.dependencies;
  newPackage.engines = oldPackage.engines;
  fs.writeFileSync(`dist/package.json`, JSON.stringify(newPackage, undefined, 2));
  fs.copyFileSync('LICENSE', `dist/LICENSE`);
  fs.copyFileSync('README.md', `dist/README.md`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
