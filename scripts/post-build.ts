import * as fs from 'fs';
import * as util from 'util';
const copyFile = util.promisify(fs.copyFile);
const DIST = 'dist';

(async () => {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json').toString());
    delete pkg['devDependencies'];
    delete pkg['scripts'];
    delete pkg['husky'];
    delete pkg['lint-staged'];
    fs.writeFileSync(`${DIST}/package.json`, JSON.stringify(pkg, undefined, 2));
    await copyFile('LICENSE', `${DIST}/LICENSE`);
    await copyFile('README.md', `${DIST}/README.md`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
