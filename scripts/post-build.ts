import * as fs from 'fs';

try {
  const rootPackage = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }));
  const libPackage: any = {};
  libPackage.name = rootPackage.name;
  libPackage.version = rootPackage.version;
  libPackage.description = rootPackage.description;
  libPackage.keywords = rootPackage.keywords;
  libPackage.author = rootPackage.author;
  libPackage.repository = rootPackage.repository;
  libPackage.homepage = rootPackage.homepage;
  libPackage.license = rootPackage.license;
  libPackage.typings = 'types/index.d.ts';
  libPackage.main = 'index.js';
  libPackage.dependencies = rootPackage.dependencies;
  libPackage.optionalDependencies = rootPackage.optionalDependencies;
  libPackage.engines = rootPackage.engines;
  fs.writeFileSync(`dist/package.json`, JSON.stringify(libPackage, undefined, 2));
  fs.copyFileSync('LICENSE', `dist/LICENSE`);
  fs.copyFileSync('README.md', `dist/README.md`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
