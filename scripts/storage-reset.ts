// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');
import * as Configstore from 'configstore';
import * as fs from 'fs';

export function reset(): void {
  const config = new Configstore(`${pkg.name}@${pkg.version}`);
  const files = config.all;
  for (const id in files) {
    try {
      fs.unlinkSync(files[id].path);
    } catch {}
  }
  config.clear();
}

reset();
