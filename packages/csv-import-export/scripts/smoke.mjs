/**
 * Packs the package the way `pnpm publish` does, extracts the tarball inside
 * the package directory, and loads the server entry point from it.
 *
 * Why pack: the repo root .gitignore has `dist/`, and a missing `files` entry
 * once shipped admin-api without its build. The tarball is the artifact that
 * matters. It is extracted inside the package (not the OS temp dir) so that
 * runtime dependencies resolve from this package's node_modules.
 */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const tmp = await mkdtemp(join(process.cwd(), '.smoke-'));

try {
  execFileSync('pnpm', ['pack', '--pack-destination', tmp], { stdio: 'pipe' });
  const tarball = (await readdir(tmp)).find((f) => f.endsWith('.tgz'));
  assert.ok(tarball, 'pnpm pack produced no tarball');

  execFileSync('tar', ['-xzf', join(tmp, tarball), '-C', tmp], { stdio: 'pipe' });
  const pkgDir = join(tmp, 'package');

  for (const file of ['dist/admin/index.js', 'dist/admin/index.mjs', 'dist/server/index.js', 'dist/server/index.mjs']) {
    assert.ok(existsSync(join(pkgDir, file)), `tarball is missing ${file}`);
  }

  const require = createRequire(join(pkgDir, 'package.json'));
  const server = require('./dist/server/index.js');
  const plugin = server.default ?? server;

  for (const key of ['register', 'bootstrap', 'destroy']) {
    assert.equal(typeof plugin[key], 'function', `server entry must export ${key}()`);
  }
  assert.equal(plugin.routes.admin.type, 'admin', 'routes must be admin routes');
  assert.equal(plugin.routes.admin.routes.length, 8, 'expected 8 admin routes');
  assert.ok(plugin.contentTypes.job?.schema?.attributes?.targetUid, 'job content type must ship in the build');
  require('papaparse');

  console.log(`smoke ok: tarball loads, ${plugin.routes.admin.routes.length} routes registered`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
