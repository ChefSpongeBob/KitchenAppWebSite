export function createTestR2() {
  const objects = new Map();
  const calls = { get: 0, put: 0, delete: 0, list: 0 };
  let version = 0;
  const bucket = {
    async get(key) {
      calls.get++;
      const row = objects.get(key);
      return row ? { key, size: Buffer.byteLength(row.body), etag: row.etag, async text() { return row.body; } } : null;
    },
    async put(key, body, options = {}) {
      calls.put++;
      const previous = objects.get(key);
      if (options.onlyIf?.etagMatches && previous?.etag !== options.onlyIf.etagMatches) return null;
      if (options.onlyIf?.etagDoesNotMatch === '*' && previous) return null;
      const row = { body, etag: 'fixture-'+(++version) };
      objects.set(key,row); return { key, etag: row.etag };
    },
    async list({ prefix, limit }) {
      calls.list++;
      return { objects: [...objects.keys()].filter(key => key.startsWith(prefix)).sort().slice(0,limit).map(key => ({ key })) };
    },
    async delete(keys) {
      calls.delete++;
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    }
  };
  return { bucket, objects, calls };
}
