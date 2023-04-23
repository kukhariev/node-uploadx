import { Bench } from 'tinybench';
import { fnv, fnv64, hash, md5, memoize } from '@uploadx/core';

const bench = new Bench({ time: 100 });
const args = ['1000000000'];
const memoized_fnv64 = memoize(fnv64);
const memoized_md5 = memoize(md5);
bench
  .add('fnv64', async () => {
    fnv64(args[0]);
  })
  .add('memoized_fnv64', async () => {
    memoized_fnv64(args[0]);
  })
  .add('memoized_md5', async () => {
    memoized_md5(args[0]);
  })
  .add('fnv', async () => {
    fnv(args[0]);
  })
  .add('md5', async () => {
    md5(args[0]);
  })
  .add('hash', async () => {
    hash(args[0]);
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
