type D1 = App.Platform['env']['DB'];

const TEMP_RETENTION_SECONDS = 60 * 60 * 24 * 3;
const LEGACY_TIMESTAMP_FLOOR = 1_577_836_800; // January 1, 2020 UTC

let lastTempCleanupAt = 0;

export async function cleanupExpiredTemps(
  db: D1,
  now = Math.floor(Date.now() / 1000)
) {
  if (now - lastTempCleanupAt < 1800) return;
  lastTempCleanupAt = now;

  const cutoff = now - TEMP_RETENTION_SECONDS;

  await db
    .prepare(
      `
      DELETE FROM temps
      WHERE ts >= ? AND ts < ?
      `
    )
    .bind(LEGACY_TIMESTAMP_FLOOR, cutoff)
    .run();
}
