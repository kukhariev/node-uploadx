/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Bench } from 'tinybench';
import { deepMask } from '@uploadx/core';
import MaskJson from 'mask-json';

const blacklist = ['token'];

const maskJson = MaskJson(blacklist);
const mask = deepMask(blacklist, (/** @type { string } */ val) => '***');

const bench = new Bench({ time: 100 });

bench
  .add('deepMask', async () => {
    mask({ headers: { token: '11111' } });
  })
  .add('maskJson', async () => {
    maskJson({ headers: { token: '11111' } });
  });

void bench.run().then(() => {
  // eslint-disable-next-line no-console
  console.table(
    bench.tasks.map(({ name, result }) =>
      result
        ? {
            'Task Name': name,
            'ops/sec': parseInt(String(result.hz), 10).toLocaleString(),
            'Average Time (ns)': result.mean * 1000 * 1000,
            Margin: `\xb1${result.rme.toFixed(2)}%`,
            Samples: result.samples.length
          }
        : null
    )
  );
});
