import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const layoutOptionsPath = resolve('src/routes/+layout.ts');
const existingLayoutOptions = existsSync(layoutOptionsPath)
  ? readFileSync(layoutOptionsPath, 'utf8')
  : null;

if (existingLayoutOptions !== null) {
  throw new Error(
    'Native build cannot safely replace src/routes/+layout.ts because that file already exists.'
  );
}

try {
  // The native package is a client-rendered bundle. Cloudflare remains the SSR target.
  writeFileSync(
    layoutOptionsPath,
    "export const ssr = false;\n",
    'utf8'
  );

  const viteCli = resolve('node_modules/vite/bin/vite.js');
  const result = spawnSync(process.execPath, [viteCli, 'build'], {
    cwd: process.cwd(),
    env: { ...process.env, NATIVE_BUILD: 'true' },
    stdio: 'inherit'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  rmSync(layoutOptionsPath, { force: true });
}
