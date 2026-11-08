import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdir, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const pluginRequire = createRequire(resolve('node_modules/@sveltejs/vite-plugin-svelte/package.json'));
const mergePath = pluginRequire.resolve('deepmerge');
assert.equal(realpathSync(mergePath), realpathSync('node_modules/deepmerge/index.cjs'),
  'The actual Vite plugin must load the installed archive, never an unrelated parent dependency');
assert.equal(readFileSync(mergePath, 'utf8').replaceAll('\r\n', '\n'),
  readFileSync('vendor/deepmerge/index.cjs', 'utf8').replaceAll('\r\n', '\n'),
  'Installed patch must match its reviewable source');
const archive = 'vendor/deepmerge/crimini-deepmerge-4.3.1-patched.1.tgz';
assert.equal(lock.packages['node_modules/deepmerge'].integrity,
  `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`);
assert.ok(Object.values(lock.packages).every(pkg => !pkg.link && !pkg.extraneous));
const merge = pluginRequire('deepmerge');
const localPackage = JSON.parse(readFileSync('vendor/deepmerge/package.json', 'utf8'));
assert.equal(localPackage.name, '@crimini/deepmerge');
assert.equal(localPackage.private, true);
assert.ok(!Object.values(lock.packages).some(pkg => pkg.name === 'deepmerge' || pkg.resolved?.includes('/deepmerge/-/')),
  'No vulnerable registry deepmerge may remain in the lockfile');

const hostile = JSON.parse('{"__proto__":{"criminiPoison":true},"constructor":{"prototype":{"criminiPoison":true}},"prototype":{"criminiPoison":true},"ok":1}');
const targets = [{}, Object.create(null), JSON.parse('{"__proto__":{"criminiPoison":true}}'), null, 0];
for (const target of targets) {
  const output = merge(target, hostile);
  assert.equal(Object.getPrototypeOf(output), Object.prototype);
  assert.equal(output.criminiPoison, undefined);
  assert.equal(output.ok, 1);
  for (const key of ['__proto__', 'constructor', 'prototype']) assert.equal(Object.hasOwn(output, key), false);
}
for (const target of [null, undefined, 0, {}, Object.create(null)]) {
  const output = merge({ session: target }, { session: hostile });
  assert.equal(Object.getPrototypeOf(output.session), Object.prototype);
  assert.equal(output.session.criminiPoison, undefined);
  assert.equal(output.session.ok, 1);
}
const poisonedTarget = merge(hostile, {});
assert.equal(poisonedTarget.criminiPoison, undefined);
assert.equal(Object.hasOwn(poisonedTarget, '__proto__'), false, 'Target-copy loop is guarded too');
assert.equal(({}).criminiPoison, undefined);
const throwingTarget = new Proxy({}, { has() { throw Error('Hostile lookup'); } });
assert.deepEqual(merge(throwingTarget, { denied: { nested: true } }), {}, 'Throwing lookups fail closed');
console.log('PASS patched merge rejects prototype keys for both loops, null/primitive placeholders and throwing proxies');

const preprocess = () => 'compiler callback';
const date = new Date('2026-01-01T00:00:00Z');
const pattern = /test/;
const symbol = Symbol('config');
const target = { nested: { first: true }, list: [{ first: true }], preprocess, date, pattern, [symbol]: 1 };
const source = { nested: { second: true }, list: [{ second: true }], [symbol]: 2 };
const output = merge(target, source, { arrayMerge: (_target, next) => next });
assert.deepEqual(output.nested, { first: true, second: true });
assert.equal(output.list, source.list, 'Vite replaces configured arrays');
assert.equal(output.preprocess, preprocess);
assert.equal(output.date, date);
assert.equal(output.pattern, pattern);
assert.equal(output[symbol], 2);
assert.deepEqual(target.nested, { first: true });
assert.notEqual(output.nested, target.nested);
assert.deepEqual(merge({ a: [1] }, { a: [2] }).a, [1, 2]);
assert.equal(merge({}, { nested: source.nested }, { clone: false }).nested, source.nested);
assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
assert.throws(() => merge.all({}), /first argument should be an array/);
assert.deepEqual(merge({ a: { n: 1 } }, { a: { n: 2 } }, {
  customMerge: key => key === 'a' ? (a, b) => ({ n: a.n + b.n }) : undefined
}).a, { n: 3 });
assert.deepEqual(merge(null, { nested: { ok: 1 } }), { nested: { ok: 1 } });
console.log('PASS Vite config array replacement, nested merges, cloning, symbols, dates, regex, callbacks and custom options stay compatible');

const capacitorRequire = createRequire(resolve('node_modules/@capacitor/cli/package.json'));
const rimrafPackage = JSON.parse(readFileSync(capacitorRequire.resolve('rimraf/package.json'), 'utf8'));
assert.equal(rimrafPackage.version, '6.1.4');
assert.equal(typeof capacitorRequire('rimraf').rimraf.sync, 'function', 'Keep Capacitor iOS cleanup API');
const globRequire = createRequire(capacitorRequire.resolve('rimraf/package.json'));
const globPackage = JSON.parse(readFileSync(globRequire.resolve('glob/package.json'), 'utf8'));
assert.match(globPackage.version, /^14\./);
assert.ok(Number(globPackage.version.split('.')[2]) >= 2, 'Patched cancellation release');
const { glob } = globRequire('glob');
let reads = 0;
const controller = new AbortController();
controller.abort(new Error('Already cancelled'));
await assert.rejects(glob('**/*', {
  cwd: process.cwd(), signal: controller.signal,
  fs: { readdir(_path, _options, callback) { reads++; callback(null, []); } }
}), /Already cancelled/);
await new Promise(resolve => setTimeout(resolve, 30));
assert.equal(reads, 0, 'Cancelled walks must not perform background filesystem work');
const midWalk = new AbortController();
let readsAtAbort = 0;
let midWalkReads = 0;
await assert.rejects(glob('**/*', {
  cwd: resolve('vendor'), signal: midWalk.signal,
  fs: { readdir(path, options, callback) {
    midWalkReads++;
    readdir(path, options, (error, entries) => {
      if (!midWalk.signal.aborted) {
        readsAtAbort = midWalkReads;
        midWalk.abort(new Error('Cancelled during traversal'));
      }
      callback(error, entries);
    });
  } }
}), /Cancelled during traversal/);
await new Promise(resolve => setTimeout(resolve, 30));
assert.ok(readsAtAbort > 0, 'Exercise a started filesystem walk, not only a pre-aborted signal');
assert.equal(midWalkReads, readsAtAbort, 'No new directory reads after mid-walk cancellation');
const minimatchRequire = createRequire(globRequire.resolve('glob/package.json'));
assert.match(JSON.parse(readFileSync(minimatchRequire.resolve('minimatch/package.json'), 'utf8')).version, /^11\./);
console.log('PASS Capacitor cleanup API, patched glob cancellation and minimatch resolution');

function files(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => !['node_modules', '.wrangler', '.git'].includes(entry.name))
    .flatMap(entry => entry.isDirectory()
    ? files(`${root}/${entry.name}`) : [`${root}/${entry.name}`]);
}
const runtimeToolImport = /(?:from\s*|import\s*\(|require\s*\()\s*['"](?:deepmerge|@crimini\/deepmerge|@capacitor\/cli|rimraf|glob|minimatch)(?:['"/])/;
for (const file of [...files('src'), ...files('workers')].filter(file => /\.(?:ts|js|svelte)$/.test(file))) {
  assert.equal(runtimeToolImport.test(readFileSync(file, 'utf8')), false, `Build tool imported by runtime: ${file}`);
}
const artifacts = ['.svelte-kit/cloudflare', '.svelte-kit/output', 'mobile-dist'];
for (const root of artifacts.filter(existsSync)) {
  for (const file of files(root).filter(file => /\.(?:[mc]?js|map)$/.test(file))) {
    const body = readFileSync(file, 'utf8');
    assert.equal(/GHSA-gcqx-w48m-w2h4|@crimini\/deepmerge|node_modules\/(?:deepmerge|rimraf|glob|minimatch)\//.test(body), false,
      `Build-only dependency leaked into emitted artifact: ${file}`);
  }
}
console.log('PASS build-tool/runtime import boundary and existing emitted artifact checks');
