import { dev } from '$app/env';

type DB = App.RuntimeEnv['DB'];

export type TemperatureAlertType = 'high' | 'low' | 'stale' | 'offline' | 'recovered';

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

type LatestTemperatureSnapshotRow = TemperatureSensorSetting & {
  name: string;
  last_seen_at: number | null;
  temperature: number | null;
  humidity_pct: number | null;
  ts: number | null;
};

export type TemperatureConnectionStatus = 'online' | 'offline' | 'never';
export type TemperatureCondition = 'normal' | 'high' | 'low' | 'offline' | 'never' | 'disabled';

export type LatestTemperatureSnapshot = LatestTemperatureSnapshotRow & {
  last_contact_at: number | null;
  connection_status: TemperatureConnectionStatus;
  condition: TemperatureCondition;
};

export type CurrentTemperatureException = {
  sensorId: number;
  name: string;
  eventType: 'high' | 'low' | 'offline';
  temperature: number | null;
  threshold: number | null;
  lastSeenAt: number | null;
};

const DEFAULT_HIGH_THRESHOLD = 42;
const DEFAULT_LOW_THRESHOLD = 32;
const DEFAULT_STALE_MINUTES = 15;
const DEFAULT_OFFLINE_MINUTES = 45;
const DEFAULT_COOLDOWN_MINUTES = 60;
const HIGH_NOTIFICATION_DELAY_SECONDS = 60 * 60;
export const TEMPERATURE_ONLINE_WINDOW_SECONDS = 10 * 60;

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

export async function loadLatestTemperatureSnapshots(
  db: DB,
  businessId: string,
  requestedLimit = 25
) {
  await ensureTemperatureMonitoringSchema(db);
  const limit = Math.max(1, Math.min(500, Math.floor(requestedLimit)));
  const rows = await db
    .prepare(
      `
      SELECT
        sn.sensor_id,
        sn.display_name AS name,
        sn.last_seen_at,
        COALESCE(tss.high_threshold, ?) AS high_threshold,
        COALESCE(tss.low_threshold, ?) AS low_threshold,
        COALESCE(tss.stale_after_minutes, ?) AS stale_after_minutes,
        COALESCE(tss.offline_after_minutes, ?) AS offline_after_minutes,
        COALESCE(tss.alert_cooldown_minutes, ?) AS alert_cooldown_minutes,
        COALESCE(tss.is_alerting_enabled, 1) AS is_alerting_enabled,
        latest.temperature,
        latest.humidity_pct,
        latest.ts
      FROM temperature_sensor_nodes sn
      LEFT JOIN temperature_sensor_settings tss
        ON tss.business_id = sn.business_id
        AND tss.sensor_id = sn.sensor_id
      LEFT JOIN temps latest
        ON latest.id = (
          SELECT t.id
          FROM temps t
          WHERE t.business_id = sn.business_id
            AND t.sensor_id = sn.sensor_id
          ORDER BY t.ts DESC, t.id DESC
          LIMIT 1
        )
      WHERE sn.business_id = ?
        AND sn.is_active = 1
        AND sn.revoked_at IS NULL
      ORDER BY sn.sensor_id ASC
      LIMIT ?
      `
    )
    .bind(
      DEFAULT_HIGH_THRESHOLD,
      DEFAULT_LOW_THRESHOLD,
      DEFAULT_STALE_MINUTES,
      DEFAULT_OFFLINE_MINUTES,
      DEFAULT_COOLDOWN_MINUTES,
      businessId,
      limit
    )
    .all<LatestTemperatureSnapshotRow>();

  return (rows.results ?? []).map((snapshot) => deriveTemperatureSnapshotState(snapshot));
}

export function deriveTemperatureSnapshotState(
  snapshot: LatestTemperatureSnapshotRow,
  now = nowSeconds()
): LatestTemperatureSnapshot {
  const lastContactAt =
    snapshot.last_seen_at !== null && Number.isFinite(snapshot.last_seen_at) && snapshot.last_seen_at > 0
      ? snapshot.last_seen_at
      : snapshot.ts !== null && Number.isFinite(snapshot.ts) && snapshot.ts > 0
        ? snapshot.ts
        : null;
  const connectionStatus: TemperatureConnectionStatus =
    lastContactAt === null
      ? 'never'
      : now - lastContactAt < TEMPERATURE_ONLINE_WINDOW_SECONDS
        ? 'online'
        : 'offline';

  let condition: TemperatureCondition;
  if (connectionStatus === 'never') {
    condition = 'never';
  } else if (connectionStatus === 'offline') {
    condition = 'offline';
  } else if (snapshot.is_alerting_enabled !== 1) {
    condition = 'disabled';
  } else if (snapshot.temperature !== null && snapshot.temperature > snapshot.high_threshold) {
    condition = 'high';
  } else if (snapshot.temperature !== null && snapshot.temperature <= snapshot.low_threshold) {
    condition = 'low';
  } else {
    condition = 'normal';
  }

  return {
    ...snapshot,
    last_contact_at: lastContactAt,
    temperature: connectionStatus === 'online' ? snapshot.temperature : null,
    humidity_pct: connectionStatus === 'online' ? snapshot.humidity_pct : null,
    connection_status: connectionStatus,
    condition
  };
}

export function temperatureExceptionsFromSnapshots(snapshots: LatestTemperatureSnapshot[]) {
  return snapshots
    .filter((snapshot) => ['high', 'low', 'offline', 'never'].includes(snapshot.condition))
    .map<CurrentTemperatureException>((snapshot) => {
      const eventType = snapshot.condition === 'high' || snapshot.condition === 'low'
        ? snapshot.condition
        : 'offline';
      return {
        sensorId: snapshot.sensor_id,
        name: snapshot.name,
        eventType,
        temperature: eventType === 'offline' ? null : snapshot.temperature,
        threshold:
          eventType === 'high'
            ? snapshot.high_threshold
            : eventType === 'low'
              ? snapshot.low_threshold
              : null,
        lastSeenAt: snapshot.last_contact_at
      };
    });
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

  if (!input.isAlertingEnabled) {
    await recoverSensorAlerts(db, input.businessId, sensorId);
  }
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
        status = 'active',
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
      WHERE temperature_alert_events.status != 'active'
        OR temperature_alert_events.temperature IS NOT excluded.temperature
        OR temperature_alert_events.threshold IS NOT excluded.threshold
        OR temperature_alert_events.reading_ts IS NOT excluded.reading_ts
        OR temperature_alert_events.metadata_json != excluded.metadata_json
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
      continuityGapSeconds
    )
    .run();
}

async function recoverSensorAlertTypes(
  db: DB,
  businessId: string,
  sensorId: number,
  eventTypes: TemperatureAlertType[]
) {
  if (eventTypes.length === 0) return;
  const now = nowSeconds();
  const placeholders = eventTypes.map(() => '?').join(', ');
  await db
    .prepare(
      `
      UPDATE temperature_alert_events
      SET status = 'recovered',
          recovered_at = ?,
          last_seen_at = ?
      WHERE business_id = ?
        AND sensor_id = ?
        AND status = 'active'
        AND event_type IN (${placeholders})
      `
    )
    .bind(now, now, businessId, sensorId, ...eventTypes)
    .run();
}

async function recoverSensorAlerts(db: DB, businessId: string, sensorId: number) {
  await recoverSensorAlertTypes(db, businessId, sensorId, ['high', 'low', 'stale', 'offline']);
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
    if (setting.is_alerting_enabled !== 1) {
      await recoverSensorAlerts(db, input.businessId, reading.sensor_id);
      continue;
    }

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
      await recoverSensorAlertTypes(db, input.businessId, reading.sensor_id, ['high', 'low', 'stale', 'offline']);
      continue;
    }

    await recoverSensorAlertTypes(
      db,
      input.businessId,
      reading.sensor_id,
      eventType === 'high' ? ['low', 'stale', 'offline'] : ['high', 'stale', 'offline']
    );

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
        COALESCE(MAX(sn.last_seen_at), MAX(t.ts)) AS last_reading_ts
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

  const connectivityRows = await db
    .prepare(
      `
      SELECT sensor_id, event_type
      FROM temperature_alert_events
      WHERE business_id = ?
        AND status = 'active'
        AND event_type IN ('stale', 'offline')
      LIMIT 1000
      `
    )
    .bind(businessId)
    .all<{ sensor_id: number; event_type: 'stale' | 'offline' }>();
  const activeConnectivity = new Map<number, Set<'stale' | 'offline'>>();
  for (const alert of connectivityRows.results ?? []) {
    const types = activeConnectivity.get(alert.sensor_id) ?? new Set<'stale' | 'offline'>();
    types.add(alert.event_type);
    activeConnectivity.set(alert.sensor_id, types);
  }

  let processed = 0;
  for (const row of rows.results ?? []) {
    if (row.is_alerting_enabled !== 1) {
      await recoverSensorAlerts(db, businessId, row.sensor_id);
      continue;
    }
    if (!row.last_reading_ts) continue;
    const staleAt = row.last_reading_ts + row.stale_after_minutes * 60;
    const offlineAt = row.last_reading_ts + row.offline_after_minutes * 60;
    const eventType: TemperatureAlertType | null =
      now >= offlineAt ? 'offline' : now >= staleAt ? 'stale' : null;
    const activeTypes = activeConnectivity.get(row.sensor_id) ?? new Set<'stale' | 'offline'>();
    if (!eventType) {
      if (activeTypes.size > 0) {
        await recoverSensorAlertTypes(db, businessId, row.sensor_id, Array.from(activeTypes));
      }
      continue;
    }

    const connectivityType = eventType as 'stale' | 'offline';
    const oppositeType = connectivityType === 'offline' ? 'stale' : 'offline';
    await recoverSensorAlertTypes(db, businessId, row.sensor_id, ['high', 'low', oppositeType]);

    if (!activeTypes.has(connectivityType)) {
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
    }
    processed += 1;
  }

  return { processed };
}
