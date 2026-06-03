export function normalizeDeviceSerial(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sensorNodeIdFromSerial(serial: string) {
  const normalized = normalizeDeviceSerial(serial);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147480000 || 1;
}
