type D1 = App.RuntimeEnv['DB'];
import { TEMPERATURE_HISTORY_READINGS } from '#lib/temperatureTiming.ts';
import { archiveTemperatureReadings, type ArchivedTemperatureReading } from '#lib/server/temperatureArchive.ts';

const TEMP_CLEANUP_BATCH_SIZE = 250;

export async function cleanupExpiredTemps(
  db: D1,
  bucket: App.RuntimeEnv['DOC_MEDIA'],
  businessId: string,
  sensorIds?: number[],
  now = Math.floor(Date.now() / 1000)
) {
  if (!bucket) throw new Error('Temperature archive storage unavailable.');
  const filtered = sensorIds?.length ? 'AND sensor_id IN (SELECT value FROM json_each(?))' : '';
  const result = await db.prepare(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY sensor_id ORDER BY ts DESC, id DESC) AS position
      FROM temps WHERE business_id = ? ${filtered}
    )
    SELECT t.id, t.sensor_id, t.temperature, t.humidity_pct, t.ts,
      COALESCE(sn.display_name, 'Sensor ' || t.sensor_id) AS sensor_name
    FROM ranked r JOIN temps t ON t.id = r.id
    LEFT JOIN temperature_sensor_nodes sn ON sn.business_id = t.business_id AND sn.sensor_id = t.sensor_id
    WHERE r.position > ? AND t.business_id = ? ORDER BY t.ts ASC, t.id ASC LIMIT ?
  `).bind(businessId, ...(sensorIds?.length ? [JSON.stringify(sensorIds)] : []),
    TEMPERATURE_HISTORY_READINGS, businessId, TEMP_CLEANUP_BATCH_SIZE).all<ArchivedTemperatureReading>();
  const rows = result.results ?? [];
  if (!rows.length) return { removed: 0, archiveUnavailable: false };
  await archiveTemperatureReadings(bucket, businessId, rows, now);
  // Delete only this archived selection, never a concurrently inserted reading or another tenant.
  const deleted = await db.prepare(`DELETE FROM temps WHERE business_id = ?
    AND id IN (SELECT value FROM json_each(?))`).bind(businessId, JSON.stringify(rows.map(row => row.id))).run();
  return { removed: deleted.meta.changes, archiveUnavailable: false };
}
