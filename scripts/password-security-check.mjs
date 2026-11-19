import assert from 'node:assert/strict';
import { pbkdf2Sync, scryptSync, createHash } from 'node:crypto';
import { loadServerModules } from './helpers/test-d1.mjs';

const load = loadServerModules();
const auth = load('src/lib/server/auth.ts');
const password = 'Isolated-password-\u00e9-only!';
const original = { PASSWORD_PEPPER: 'isolated-original-pepper-0000000000000', PASSWORD_PEPPER_VERSION: 'original' };
const current = { PASSWORD_PEPPER: 'isolated-current-pepper-11111111111111', PASSWORD_PEPPER_VERSION: 'current',
  PASSWORD_PREVIOUS_PEPPERS: JSON.stringify({ original: original.PASSWORD_PEPPER }) };
const first = await auth.hashPassword(password, original);
const second = await auth.hashPassword(password, original);
assert.notEqual(first, second, 'Every password gets a fresh 128-bit salt');
const parts = first.split('$');
assert.deepEqual(parts.slice(0, 5), ['scrypt_peppered', '16384', '8', '5', 'original']);
assert.equal(parts[5].length, 32);
assert.equal(parts[6], scryptSync(password + '\0' + original.PASSWORD_PEPPER, Buffer.from(parts[5], 'hex'), 32,
  { N: 16384, r: 8, p: 5, maxmem: 24 * 1024 * 1024 }).toString('hex'));
assert.deepEqual(await auth.verifyPassword(password, first, original), { valid: true, needsRehash: false, upgradedHash: undefined });
assert.equal((await auth.verifyPassword('wrong', first, original)).valid, false);
const afterRotation = await auth.verifyPassword(password, first, current);
assert.equal(afterRotation.valid, true); assert.equal(afterRotation.needsRehash, true);
assert.match(afterRotation.upgradedHash, /^scrypt_peppered\$16384\$8\$5\$current\$/);
assert.equal((await auth.verifyPassword(password, afterRotation.upgradedHash, current)).valid, true);
assert.equal((await auth.verifyPassword(password, first, { ...current, PASSWORD_PREVIOUS_PEPPERS: undefined })).valid, false);
const salt = '11'.repeat(16);
for (const legacy of [
  'pbkdf2_sha256_peppered$100000$' + salt + '$' + pbkdf2Sync(password + '\0' + original.PASSWORD_PEPPER, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex'),
  'pbkdf2_sha256$100000$' + salt + '$' + pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex'),
  createHash('sha256').update(password).digest('hex')
]) {
  const result = await auth.verifyPassword(password, legacy, current);
  assert.equal(result.valid, true); assert.equal(result.needsRehash, true);
  assert.equal((await auth.verifyPassword(password, result.upgradedHash, current)).valid, true);
  assert.equal((await auth.verifyPassword('wrong', legacy, current)).valid, false);
}
let costlyCalls = 0;
const bounded = loadServerModules({ 'node:crypto': { scrypt() { costlyCalls++; throw Error('Must reject before KDF'); } } })('src/lib/server/auth.ts');
for (const malformed of [
  first.replace('$16384$', '$131072$'), first.replace('$8$', '$128$'), first.replace('$5$', '$100000$'),
  first.replace('$original$', '$unknown$'), first.replace(parts[5], 'invalid-salt'), first.replace(parts[6], 'invalid-digest'),
  'pbkdf2_sha256_peppered$1000000000$' + salt + '$' + '00'.repeat(32), 'not-a-password-hash'
]) assert.equal((await bounded.verifyPassword(password, malformed, current)).valid, false);
assert.equal(costlyCalls, 0);
for (const malformed of ['[]', 'invalid', '{"original":""}', JSON.stringify({ current: original.PASSWORD_PEPPER })]) {
  await assert.rejects(auth.hashPassword(password, { ...current, PASSWORD_PREVIOUS_PEPPERS: malformed }));
  assert.equal((await auth.verifyPassword(password, first, { ...current, PASSWORD_PREVIOUS_PEPPERS: malformed })).valid, false);
}
console.log('PASS password storage: native OWASP scrypt vector, fresh salts, correct/invalid/Unicode passwords, existing PBKDF2/SHA migration, bounded versioned pepper rotation and rejection before attacker-selected KDF costs');
