import path from 'path';
import { fileURLToPath } from 'url';

import mdx from '@mdx-js/esbuild';
import { context, build } from 'esbuild';

const loaderPlugin = {
  name: 'loader',
  setup(build) {
    // strips out the `compact-json!` prefix and loads the JSON file
    build.onResolve({ filter: /^compact-json!/ }, (args) => {
      return {
        path: path.resolve(
          args.resolveDir,
          args.path.replace(/^compact-json!/, '')
        ),
        // loader: 'json',
      };
    });
  },
};

const opts = {
  absWorkingDir: path.dirname(fileURLToPath(import.meta.url)),
  logLevel: 'info',
  entryPoints: ['app/entry.tsx', 'app/tile-worker.ts'],
  outbase: 'app',
  outdir: 'build',
  format: 'esm',
  bundle: true,
  sourcemap: true,
  minify: false,
  splitting: true,
  plugins: [mdx(), loaderPlugin],
  loader: {
    '.geojson': 'json',
  },
};

async function run(mode) {
  if (mode === 'build') {
    build(opts);
  } else if (mode === 'watch') {
    build({ ...opts, watch: true });
  } else if (mode === 'serve') {
    (await context(opts)).serve({ servedir: '.' });
  }
}

run(process.argv[2] || 'build').catch((e) => {
  console.error(e);
  process.exit(1);
});
