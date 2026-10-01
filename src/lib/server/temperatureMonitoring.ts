import { dev } from '$app/environment';

type DB = App.Platform['env']['DB'];

export type TemperatureAlertType = 'high' | 'low' | 'stale' | 'offline' | 'recovered';
export type TemperatureAlertStatus = 'active' | 'acknowledged' | 'recovered';

export type TemperatureReading = {
  sensor_id: number;
  temperature: number;
  humidity_pct: number | null;
  packet_sequence?: number | null;
  wake_nonce?: string | null;
  lqi?: number | null;
  ts: number;
};

export type TemperatureSensorSetting = {
  sensor_id: number;
  high_threshold: number;
  low_threshold: number;
  stale_after_minutes: number;
  offline_after_minutes: number;
  alert_cooldown_minutes: number;
  is_alerting_enabled: number;
};

export type TemperatureAlertEvent = {
  id: string;
  business_id: string;
  sensor_id: number;
  event_type: TemperatureAlertType;
  status: TemperatureAlertStatus;
  temperature: number | null;
  threshold: number | null;
  reading_ts: number | null;
  first_seen_at: number;
  last_seen_at: number;
  acknowledged_at: number | null;
  acknowledged_by: string | null;
  recovered_at: number | null;
  notification_ready_at: number | null;
  dedupe_key: string;
  metadata_json: string;
};

const DEFAULT_HIGH_THRESHOLD = 42;
const DEFAULT_LOW_THRESHOLD = 32;
const DEFAULT_STALE_MINUTES = 15;
const DEFAULT_OFFLINE_MINUTES = 45;
const DEFAULT_COOLDOWN_MINUTES = 60;
const HIGH_NOTIFICATION_DELAY_SECONDS = 60 * 60;

let temperatureMonitoringSchemaEnsured = false;
let temperatureMonitoringSchemaPromise: Promise<void> | null = null;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function clampNumber(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function alertDedupeKey(sensorId: number, eventType: TemperatureAlertType) {
  return `temperature:${sensorId}:${eventType}`;
}

async function ensureOptionalColumn(db: DB, tableName: string, columnName: string, definition: string) {
  try {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('duplicate column name') || message.includes('already exists')) return;
    throw error;
  }
}

export async function ensureTemperatureMonitoringSchema(db: DB) {
  if (!dev) {
    temperatureMonitoringSchemaEnsured = true;
    return;
  }
  if (temperatureMonitoringSchemaEnsured) return;
  if (temperatureMonitoringSchemaPromise) {
    await temperatureMonitoringSchemaPromise;
    return;
  }

  temperatureMonitoringSchemaPromise = (async () => {
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS temperature_sensor_settings (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          sensor_id INTEGER NOT NULL,
          high_threshold REAL NOT NULL DEFAULT 42,
          low_threshold REAL NOT NULL DEFAULT 32,
          stale_after_minutes INTEGER NOT NULL DEFAULT 15,
          offline_after_minutes INTEGER NOT NULL DEFAULT 45,
          alert_cooldown_minutes INTEGER NOT NULL DEFAULT 60,
          is_alerting_enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          updated_by TEXT,
          UNIQUE (business_id, sensor_id)
        )
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS temperature_alert_events (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          sensor_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          temperature REAL,
          threshold REAL,
          reading_ts INTEGER,
          first_seen_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          acknowledged_at INTEGER,
          acknowledged_by TEXT,
          recovered_at INTEGER,
          notification_ready_at INTEGER,
          dedupe_key TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}'
        )
        `
      )
      .run();
    await ensureOptionalColumn(db, 'temperature_sensor_settings', 'offline_after_minutes', 'INTEGER NOT NULL DEFAULT 45');
    await ensureOptionalColumn(db, 'temperature_alert_events', 'notification_ready_at', 'INTEGER');
    await db
      .prepare(
        `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_temp_alert_events_business_dedupe
        ON temperature_alert_events(business_id, dedupe_key)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_temp_alert_events_business_status
        ON temperature_alert_events(business_id, status, event_type, last_seen_at DESC)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_temp_alert_events_business_sensor_status
        ON temperature_alert_events(business_id, sensor_id, status, last_seen_at DESC)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_temp_settings_business_sensor
        ON temperature_sensor_settings(business_id, sensor_id)
        `
      )
      .run();
    await db
      .prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_temp_alert_events_notification_ready
        ON temperature_alert_events(business_id, status, event_type, notification_ready_at)
        `
      )
      .run();
    temperatureMonitoringSchemaEnsured = true;
  })();

  await temperatureMonitoringSchemaPromise;
}

export function defaultTemperatureSetting(sensorId: number): TemperatureSensorSetting {
  return {
    sensor_id: sensorId,
    high_threshold: DEFAULT_HIGH_THRESHOLD,
    low_threshold: DEFAULT_LOW_THRESHOLD,
    stale_after_minutes: DEFAULT_STALE_MINUTES,
    offline_after_minutes: DEFAULT_OFFLINE_MINUTES,
    alert_cooldown_minutes: DEFAULT_COOLDOWN_MINUTES,
    is_alerting_enabled: 1
  };
}

export async function loadTemperatureSensorSettings(db: DB, businessId: string) {
  await ensureTemperatureMonitoringSchema(db);
  const rows = await db
    .prepare(
      `
      SELECT sensor_id, high_threshold, low_threshold, stale_after_minutes, offline_after_minutes, alert_cooldown_minutes, is_alerting_enabled
      FROM temperature_sensor_settings
      WHERE business_id = ?
      ORDER BY sensor_id ASC
      `
    )
    .bind(businessId)
    .all<TemperatureSensorSetting>();
  return rows.results ?? [];
}

export async function loadTemperatureSettingsMap(db: DB, businessId: string) {
  const settings = await loadTemperatureSensorSettings(db, businessId);
  return new Map(settings.map((setting) => [setting.sensor_id, setting]));
}

async function loadTemperatureSensorNames(db: DB, businessId: string) {
  const rows = await db
    .prepare(
      `
      SELECT sensor_id, display_name
      FROM temperature_sensor_nodes
      WHERE business_id = ?
        AND is_active = 1
        AND revoked_at IS NULL
      LIMIT 500
      `
    )
    .bind(businessId)
    .all<{ sensor_id: number; display_name: string }>();

  return new Map(
    (rows.results ?? []).map((row) => [row.sensor_id, row.display_name.trim() || `Sensor ${row.sensor_id}`])
  );
}

export async function saveTemperatureSensorSetting(
  db: DB,
  input: {
    businessId: string;
    sensorId: number;
    highThreshold: number;
    lowThreshold: number;
    staleAfterMinutes: number;
    offlineAfterMinutes: number;
    alertCooldownMinutes: number;
    isAlertingEnabled: boolean;
    updatedBy?: string | null;
  }
) {
  await ensureTemperatureMonitoringSchema(db);
  const sensorId = Math.floor(input.sensorId);
  if (!Number.isFinite(sensorId) || sensorId <= 0) throw new Error('Invalid sensor.');

  const lowThreshold = clampNumber(input.lowThreshold, DEFAULT_LOW_THRESHOLD, -80, 120);
  const highThreshold = clampNumber(input.highThreshold, DEFAULT_HIGH_THRESHOLD, -80, 180);
  if (lowThreshold >= highThreshold) throw new Error('Low must be below high.');

  const staleAfterMinutes = Math.floor(clampNumber(input.staleAfterMinutes, DEFAULT_STALE_MINUTES, 2, 1440));
  const offlineAfterMinutes = Math.floor(
    clampNumber(input.offlineAfterMinutes, Math.max(DEFAULT_OFFLINE_MINUTES, staleAfterMinutes), staleAfterMinutes, 2880)
  );
  const alertCooldownMinutes = Math.floor(clampNumber(input.alertCooldownMinutes, DEFAULT_COOLDOWN_MINUTES, 5, 1440));
  const now = nowSeconds();

  await db
    .prepare(
      `
      INSERT INTO temperature_sensor_settings (
        id,
        business_id,
        sensor_id,
        high_threshold,
        low_threshold,
        stale_after_minutes,
        offline_after_minutes,
        alert_cooldown_minutes,
        is_alerting_enabled,
        created_at,
        updated_at,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id, sensor_id) DO UPDATE SET
        high_threshold = excluded.high_threshold,
        low_threshold = excluded.low_threshold,
        stale_after_minutes = excluded.stale_after_minutes,
        offline_after_minutes = excluded.offline_after_minutes,
        alert_cooldown_minutes = excluded.alert_cooldown_minutes,
        is_alerting_enabled = excluded.is_alerting_enabled,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
      `
    )
    .bind(
      crypto.randomUUID(),
      input.businessId,
      sensorId,
      highThreshold,
      lowThreshold,
      staleAfterMinutes,
      offlineAfterMinutes,
      alertCooldownMinutes,
      input.isAlertingEnabled ? 1 : 0,
      now,
      now,
      input.updatedBy ?? null
    )
    .run();
}

export async function loadActiveTemperatureAlerts(db: DB, businessId: string) {
  await ensureTemperatureMonitoringSchema(db);
  const rows = await db
    .prepare(
      `
      SELECT *
      FROM temperature_alert_events
      WHERE business_id = ?
        AND status IN ('active', 'acknowledged')
      ORDER BY last_seen_at DESC
      LIMIT 100
      `
    )
    .bind(businessId)
    .all<TemperatureAlertEvent>();
  return rows.results ?? [];
}

export async function acknowledgeTemperatureAlert(
  db: DB,
  input: {
    businessId: string;
    alertId: string;
    acknowledgedBy: string | null;
  }
) {
  await ensureTemperatureMonitoringSchema(db);
  const now = nowSeconds();
  await db
    .prepare(
      `
      UPDATE temperature_alert_events
      SET status = 'acknowledged',
          acknowledged_at = ?,
          acknowledged_by = ?
      WHERE id = ?
        AND business_id = ?
        AND status = 'active'
      `
    )
    .bind(now, input.acknowledgedBy, input.alertId, input.businessId)
    .run();
}

async function upsertTemperatureAlert(
  db: DB,
  input: {
    businessId: string;
    sensorId: number;
    eventType: TemperatureAlertType;
    temperature?: number | null;
    threshold?: number | null;
    readingTs?: number | null;
    continuityGapSeconds?: number;
    metadata?: Record<string, unknown>;
  }
) {
  await ensureTemperatureMonitoringSchema(db);
  const now = nowSeconds();
  const dedupeKey = alertDedupeKey(input.sensorId, input.eventType);
  const continuityGapSeconds = Math.max(
    60,
    Math.floor(input.continuityGapSeconds ?? DEFAULT_STALE_MINUTES * 60)
  );
  const notificationReadyAt = input.eventType === 'high' ? now + HIGH_NOTIFICATION_DELAY_SECONDS : null;
  await db
    .prepare(
      `
      INSERT INTO temperature_alert_events (
        id,
        business_id,
        sensor_id,
        event_type,
        status,
        temperature,
        threshold,
        reading_ts,
        first_seen_at,
        last_seen_at,
        notification_ready_at,
        dedupe_key,
        metadata_json
      )
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id, dedupe_key) DO UPDATE SET
        status = CASE
          WHEN temperature_alert_events.status = 'recovered'
            OR excluded.last_seen_at - temperature_alert_events.last_seen_at > ?
          THEN 'active'
          ELSE temperature_alert_events.status
        END,
        temperature = excluded.temperature,
        threshold = excluded.threshold,
        reading_ts = excluded.reading_ts,
        first_seen_at = CASE
          WHEN temperature_alert_events.status = 'recovered'
            OR excluded.last_seen_at - temperature_alert_events.last_seen_at > ?
          THEN excluded.first_seen_at
          ELSE temperature_alert_events.first_seen_at
        END,
        last_seen_at = excluded.last_seen_at,
        acknowledged_at = CASE
          WHEN temperature_alert_events.status = 'recovered'
            OR excluded.last_seen_at - temperature_alert_events.last_seen_at > ?
          THEN NULL
          ELSE temperature_alert_events.acknowledged_at
        END,
        acknowledged_by = CASE
          WHEN temperature_alert_events.status = 'recovered'
            OR excluded.last_seen_at - temperature_alert_events.last_seen_at > ?
          THEN NULL
          ELSE temperature_alert_events.acknowledged_by
        END,
        recovered_at = CASE
          WHEN temperature_alert_events.status = 'recovered'
            OR excluded.last_seen_at - temperature_alert_events.last_seen_at > ?
          THEN NULL
          ELSE temperature_alert_events.recovered_at
        END,
        notification_ready_at = CASE
          WHEN temperature_alert_events.status = 'recovered'
            OR excluded.last_seen_at - temperature_alert_events.last_seen_at > ?
          THEN excluded.notification_ready_at
          ELSE COALESCE(temperature_alert_events.notification_ready_at, excluded.notification_ready_at)
        END,
        metadata_json = excluded.metadata_json
      `
    )
    .bind(
      crypto.randomUUID(),
      input.businessId,
      input.sensorId,
      input.eventType,
      input.temperature ?? null,
      input.threshold ?? null,
      input.readingTs ?? null,
      now,
      now,
      notificationReadyAt,
      dedupeKey,
      JSON.stringify(input.metadata ?? {}),
      continuityGapSeconds,
      continuityGapSeconds,
      continuityGapSeconds,
      continuityGapSeconds,
      continuityGapSeconds,
      continuityGapSeconds
    )
    .run();
}

async function recoverSensorAlerts(db: DB, businessId: string, sensorId: number) {
  const now = nowSeconds();
  await db
    .prepare(
      `
      UPDATE temperature_alert_events
      SET status = 'recovered',
          recovered_at = ?,
          last_seen_at = ?
      WHERE business_id = ?
        AND sensor_id = ?
        AND status IN ('active', 'acknowledged')
      `
    )
    .bind(now, now, businessId, sensorId)
    .run();
}

export async function evaluateTemperatureReadings(
  db: DB,
  input: {
    businessId: string;
    deviceId: string;
    readings: TemperatureReading[];
  }
) {
  await ensureTemperatureMonitoringSchema(db);
  const settingsMap = await loadTemperatureSettingsMap(db, input.businessId);
  const sensorNames = await loadTemperatureSensorNames(db, input.businessId);

  for (const reading of input.readings) {
    const setting = settingsMap.get(reading.sensor_id) ?? defaultTemperatureSetting(reading.sensor_id);
    if (setting.is_alerting_enabled !== 1) continue;

    let eventType: TemperatureAlertType | null = null;
    let threshold: number | null = null;
    if (reading.temperature > setting.high_threshold) {
      eventType = 'high';
      threshold = setting.high_threshold;
    } else if (reading.temperature <= setting.low_threshold) {
      eventType = 'low';
      threshold = setting.low_threshold;
    }

    if (!eventType) {
      await recoverSensorAlerts(db, input.businessId, reading.sensor_id);
      continue;
    }

    await upsertTemperatureAlert(db, {
      businessId: input.businessId,
      sensorId: reading.sensor_id,
      eventType,
      temperature: reading.temperature,
      threshold,
      readingTs: reading.ts,
      continuityGapSeconds: setting.stale_after_minutes * 60,
      metadata: {
        sensorName: sensorNames.get(reading.sensor_id) ?? `Sensor ${reading.sensor_id}`,
        deviceId: input.deviceId,
        packetSequence: reading.packet_sequence ?? null,
        wakeNonce: reading.wake_nonce ?? null,
        lqi: reading.lqi ?? null
      }
    });
  }
}

export async function processTemperatureStaleAlerts(
  db: DB,
  businessId: string,
  now = nowSeconds()
) {
  await ensureTemperatureMonitoringSchema(db);
  const rows = await db
    .prepare(
      `
      SELECT
        sn.sensor_id,
        sn.display_name,
        COALESCE(tss.high_threshold, ?) AS high_threshold,
        COALESCE(tss.low_threshold, ?) AS low_threshold,
        COALESCE(tss.stale_after_minutes, ?) AS stale_after_minutes,
        COALESCE(tss.offline_after_minutes, ?) AS offline_after_minutes,
        COALESCE(tss.alert_cooldown_minutes, ?) AS alert_cooldown_minutes,
        COALESCE(tss.is_alerting_enabled, 1) AS is_alerting_enabled,
        MAX(t.ts) AS last_reading_ts
      FROM temperature_sensor_nodes sn
      LEFT JOIN temperature_sensor_settings tss
        ON tss.business_id = sn.business_id
        AND tss.sensor_id = sn.sensor_id
      LEFT JOIN temps t
        ON t.business_id = sn.business_id
        AND t.sensor_id = sn.sensor_id
      WHERE sn.business_id = ?
        AND sn.is_active = 1
        AND sn.revoked_at IS NULL
      GROUP BY sn.sensor_id, sn.display_name
      LIMIT 500
      `
    )
    .bind(
      DEFAULT_HIGH_THRESHOLD,
      DEFAULT_LOW_THRESHOLD,
      DEFAULT_STALE_MINUTES,
      DEFAULT_OFFLINE_MINUTES,
      DEFAULT_COOLDOWN_MINUTES,
      businessId
    )
    .all<
      TemperatureSensorSetting & {
        display_name: string;
        last_reading_ts: number | null;
      }
    >();

  let processed = 0;
  for (const row of rows.results ?? []) {
    if (row.is_alerting_enabled !== 1 || !row.last_reading_ts) continue;
    const staleAt = row.last_reading_ts + row.stale_after_minutes * 60;
    const offlineAt = row.last_reading_ts + row.offline_after_minutes * 60;
    const eventType: TemperatureAlertType | null =
      now >= offlineAt ? 'offline' : now >= staleAt ? 'stale' : null;
    if (!eventType) continue;

    await upsertTemperatureAlert(db, {
      businessId,
      sensorId: row.sensor_id,
      eventType,
      readingTs: row.last_reading_ts,
      metadata: {
        sensorName: row.display_name.trim() || `Sensor ${row.sensor_id}`,
        lastReadingTs: row.last_reading_ts
      }
    });
    processed += 1;
  }

  return { processed };
}
