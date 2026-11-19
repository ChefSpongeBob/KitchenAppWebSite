export function previousSecretVersions(value: string | undefined) {
  const versions = new Map<string, string>();
  if (!value?.trim()) return versions;
  if (value.length > 16384) throw new Error('Previous-secret configuration is too large.');
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('Previous-secret configuration must be a JSON object.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Previous-secret configuration must be a JSON object.');
  }
  const entries = Object.entries(parsed);
  if (entries.length > 3) throw new Error('Keep no more than three previous secret versions.');
  for (const [version, secret] of entries) {
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(version) || ['__proto__', 'constructor', 'prototype'].includes(version) ||
      typeof secret !== 'string' || !secret.trim()) throw new Error('Invalid previous-secret configuration.');
    versions.set(version, secret.trim());
  }
  return versions;
}
