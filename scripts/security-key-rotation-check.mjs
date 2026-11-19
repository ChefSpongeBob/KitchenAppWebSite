import assert from 'node:assert/strict';
import { loadServerModules } from './helpers/test-d1.mjs';

const load = loadServerModules();
const sensitive = load('src/lib/server/sensitive.ts');
const old = { SENSITIVE_DATA_KEY: 'isolated-original-encryption-key-000000000000', SENSITIVE_DATA_KEY_VERSION: 'original' };
const current = { SENSITIVE_DATA_KEY: 'isolated-current-encryption-key-111111111111', SENSITIVE_DATA_KEY_VERSION: 'current',
  SENSITIVE_DATA_PREVIOUS_KEYS: JSON.stringify({ original: old.SENSITIVE_DATA_KEY }) };
const context = { businessId: 'isolated-a', userId: 'isolated-employee', recordScope: 'onboarding', recordType: 'personal_information' };
const payload = { legal_name: 'Isolated fixture only', tax_identifier: 'NOT-A-REAL-IDENTIFIER' };
function record(value) { return { encrypted_payload: value.encryptedPayload, payload_iv: value.payloadIv,
  key_version: value.keyVersion, encryption_algorithm: value.encryptionAlgorithm }; }
const original = record(await sensitive.encryptSensitiveJsonPayload(old, payload, context));
assert.deepEqual(await sensitive.decryptSensitiveJsonPayload(current, original, context), payload);
const rotated = record(await sensitive.encryptSensitiveJsonPayload(current, payload, context));
assert.equal(rotated.key_version, 'current');
assert.notEqual(rotated.encrypted_payload, original.encrypted_payload);
assert.deepEqual(await sensitive.decryptSensitiveJsonPayload(current, rotated, context), payload);
assert.notEqual(rotated.payload_iv, record(await sensitive.encryptSensitiveJsonPayload(current, payload, context)).payload_iv);
await assert.rejects(sensitive.decryptSensitiveJsonPayload({ ...current, SENSITIVE_DATA_PREVIOUS_KEYS: undefined }, original, context));
await assert.rejects(sensitive.decryptSensitiveJsonPayload(current, { ...original, key_version: 'unknown' }, context));
await assert.rejects(sensitive.decryptSensitiveJsonPayload(current, { ...original, encryption_algorithm: 'none' }, context));
for (const field of Object.keys(context)) {
  await assert.rejects(sensitive.decryptSensitiveJsonPayload(current, original, { ...context, [field]: 'foreign' }));
}
const altered = Buffer.from(original.encrypted_payload, 'base64'); altered[0] ^= 1;
await assert.rejects(sensitive.decryptSensitiveJsonPayload(current, { ...original, encrypted_payload: altered.toString('base64') }, context));
for (const invalid of ['not-json', '[]', '{"original":""}', JSON.stringify({ a: 'x', b: 'x', c: 'x', d: 'x' })]) {
  assert.equal(sensitive.isSensitiveEncryptionConfigured({ ...current, SENSITIVE_DATA_PREVIOUS_KEYS: invalid }), false);
  await assert.rejects(sensitive.encryptSensitiveJsonPayload({ ...current, SENSITIVE_DATA_PREVIOUS_KEYS: invalid }, payload, context));
}
await assert.rejects(sensitive.encryptSensitiveJsonPayload({ ...current, SENSITIVE_DATA_PREVIOUS_KEYS: JSON.stringify({ current: old.SENSITIVE_DATA_KEY }) }, payload, context));
assert.equal(sensitive.isSensitiveEncryptionConfigured({}), false);
assert.equal(sensitive.isSensitiveEncryptionConfigured(current), true);
const implicit = { SENSITIVE_DATA_KEY: old.SENSITIVE_DATA_KEY };
const implicitRecord = record(await sensitive.encryptSensitiveJsonPayload(implicit, payload, context));
assert.deepEqual(await sensitive.decryptSensitiveJsonPayload({ ...current,
  SENSITIVE_DATA_PREVIOUS_KEYS: JSON.stringify({ [implicitRecord.key_version]: old.SENSITIVE_DATA_KEY }) }, implicitRecord, context), payload);
console.log('PASS sensitive key rotation: previous/current/default versions, fresh IVs, ciphertext authentication, tenant/person/purpose binding, unknown versions/algorithms and malformed configuration fail closed');
