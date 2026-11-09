import { csvEscape, parseCsv } from '#lib/server/csv.ts';
import { TEMPERATURE_ARCHIVE_SECONDS } from '#lib/temperatureTiming.ts';

type Bucket = NonNullable<App.RuntimeEnv['DOC_MEDIA']>;
export type ArchivedTemperatureReading = {
  id: number;
  sensor_id: number;
  sensor_name: string;
  temperature: number;
  humidity_pct: number | null;
  ts: number;
};

const PREFIX = 'temperature-reports/v1/';
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024;
const HEADER = 'Reading ID,Sensor ID,Sensor Name,Temperature (F),Humidity (%),Measured At (Unix UTC)';

function dayFor(seconds: number) { return new Date(seconds * 1000).toISOString().slice(0, 10); }
function keyFor(businessId: string, day: string) {
  if (!businessId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid temperature archive scope.');
  return `${PREFIX}${day}/${encodeURIComponent(businessId)}.csv`;
}

export function readTemperatureArchive(text: string): ArchivedTemperatureReading[] {
  if (text.length > MAX_ARCHIVE_BYTES || !text.startsWith(HEADER + '\n')) throw new Error('Invalid temperature archive.');
  return parseCsv(text).slice(1).map(row => {
    const [id, sensor, name, temperature, humidity, ts] = row;
    const reading = { id: Number(id), sensor_id: Number(sensor), sensor_name: name,
      temperature: Number(temperature), humidity_pct: humidity === '' ? null : Number(humidity), ts: Number(ts) };
    if (row.length !== 6 || !Number.isSafeInteger(reading.id) || reading.id < 1 ||
      !Number.isSafeInteger(reading.sensor_id) || !Number.isSafeInteger(reading.ts) || !Number.isFinite(reading.temperature) ||
      (reading.humidity_pct !== null && !Number.isFinite(reading.humidity_pct))) throw new Error('Invalid temperature archive row.');
    return reading;
  });
}

export async function archiveTemperatureReadings(
  bucket: Bucket, businessId: string, readings: ArchivedTemperatureReading[], now = Math.floor(Date.now() / 1000)
) {
  const days = new Map<string, ArchivedTemperatureReading[]>();
  for (const reading of readings) {
    if (reading.ts < now - TEMPERATURE_ARCHIVE_SECONDS) continue;
    const day = dayFor(reading.ts);
    const group = days.get(day) ?? []; group.push(reading); days.set(day, group);
  }
  for (const [day, incoming] of days) {
    const key = keyFor(businessId, day);
    let saved = false;
    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      const previous = await bucket.get(key);
      if (previous && previous.size > MAX_ARCHIVE_BYTES) throw new Error('Temperature archive is too large.');
      const rows = new Map((previous ? readTemperatureArchive(await previous.text()) : []).map(row => [row.id, row]));
      for (const row of incoming) rows.set(row.id, row);
      const body = HEADER + '\n' + [...rows.values()].sort((a,b) => a.ts - b.ts || a.id - b.id)
        .map(row => [row.id, row.sensor_id, row.sensor_name, row.temperature, row.humidity_pct ?? '', row.ts].map(csvEscape).join(',')).join('\n') + '\n';
      if (new TextEncoder().encode(body).byteLength > MAX_ARCHIVE_BYTES) throw new Error('Temperature archive is too large.');
      // Conditional replacement preserves simultaneous gateway uploads and retry idempotency.
      saved = Boolean(await bucket.put(key, body, {
        onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: '*' },
        httpMetadata: { contentType: 'text/csv; charset=utf-8', cacheControl: 'private, no-store' }
      }));
    }
    if (!saved) throw new Error('Temperature archive changed. Retry required.');
  }
}

export async function visitTemperatureArchives(
  bucket: Bucket, businessId: string, startTs: number, endTs: number,
  visit: (row: ArchivedTemperatureReading) => void, now = Math.floor(Date.now() / 1000)
) {
  const first = Math.max(startTs, now - TEMPERATURE_ARCHIVE_SECONDS);
  for (let day = Math.floor(first / 86400) * 86400; day < Math.min(endTs, now + 60); day += 86400) {
    const object = await bucket.get(keyFor(businessId, dayFor(day)));
    if (!object) continue;
    if (object.size > MAX_ARCHIVE_BYTES) throw new Error('Temperature archive is too large.');
    for (const row of readTemperatureArchive(await object.text())) {
      if (row.ts >= first && row.ts < endTs) visit(row);
    }
  }
}

export async function cleanupTemperatureArchives(bucket: Bucket, now = Math.floor(Date.now() / 1000)) {
  const cutoffDay = dayFor(now - TEMPERATURE_ARCHIVE_SECONDS);
  const page = await bucket.list({ prefix: PREFIX, limit: 1000 });
  const expired = page.objects.filter(object => {
    const match = object.key.slice(PREFIX.length).match(/^(\d{4}-\d{2}-\d{2})\//);
    return match && match[1] < cutoffDay;
  }).map(object => object.key);
  if (expired.length) await bucket.delete(expired);
  return expired.length;
}
