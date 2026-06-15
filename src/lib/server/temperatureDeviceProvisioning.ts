import { dev } from '$app/environment';
import { ensureIoTDeviceSchema, type IoTDeviceRecord } from '$lib/server/iotIngest';
import { normalizeDeviceSerial, sensorNodeIdFromSerial } from '$lib/server/temperatureSensors';

type D1 = App.Platform['env']['DB'];

let schemaEnsured = false;

type InventoryRow = {
  serial: string;
  device_type: 'sensor_gateway' | 'sensor_node';
  hardware_model: string | null;
  firmware_version: string | null;
  key_hash: string | null;
  key_prefix: string | null;
  claim_status: 'available' | 'claimed' | 'revoked';
  claimed_business_id: string | null;
  claimed_iot_device_id: string | null;
};

type IoTDeviceRow = {
  id: string;
  business_id: string;
  device_type: 'sensor_gateway' | 'sensor' | 'camera';
  external_device_id: string;
  display_name: string;
  key_prefix: string;
  is_active: number;
  last_seen_at: number | null;
  revoked_at: number | null;
  created_at: number;
  updated_at: number;
};

type TemperatureSensorNodeRow = {
  id: string;
  business_id: string;
  gateway_device_id: string;
  gateway_serial: string | null;
  gateway_name: string | null;
  node_serial: string;
  sensor_id: number;
  display_name: string;
  hardware_model: string | null;
  firmware_version: string | null;
  is_active: number;
  last_seen_at: number | null;
  battery_mv: number | null;
  rssi: number | null;
  revoked_at: number | null;
  created_at: number;
  updated_at: number;
};

export type TemperatureSensorNode = {
  id: string;
  businessId: string;
  gatewayDeviceId: string;
  gatewaySerial: string | null;
  gatewayName: string | null;
  nodeSerial: string;
  sensorId: number;
  displayName: string;
  hardwareModel: string | null;
  firmwareVersion: string | null;
  isActive: number;
  lastSeenAt: number | null;
  batteryMv: number | null;
  rssi: number | null;
  revokedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

function mapIoTDevice(row: IoTDeviceRow): IoTDeviceRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    deviceType: row.device_type,
    externalDeviceId: row.external_device_id,
    displayName: row.display_name,
    keyPrefix: row.key_prefix,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTemperatureSensorNode(row: TemperatureSensorNodeRow): TemperatureSensorNode {
  return {
    id: row.id,
    businessId: row.business_id,
    gatewayDeviceId: row.gateway_device_id,
    gatewaySerial: row.gateway_serial,
    gatewayName: row.gateway_name,
    nodeSerial: row.node_serial,
    sensorId: row.sensor_id,
    displayName: row.display_name,
    hardwareModel: row.hardware_model,
    firmwareVersion: row.firmware_version,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    batteryMv: row.battery_mv,
    rssi: row.rssi,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function ensureTemperatureDeviceProvisioningSchema(db: D1) {
  if (!dev) {
    schemaEnsured = true;
    return;
  }
  if (schemaEnsured) return;
  await ensureIoTDeviceSchema(db);

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS iot_device_inventory (
        serial TEXT PRIMARY KEY,
        device_type TEXT NOT NULL CHECK (device_type IN ('sensor_gateway', 'sensor_node')),
        hardware_model TEXT,
        firmware_version TEXT,
        key_hash TEXT,
        key_prefix TEXT,
        claim_status TEXT NOT NULL DEFAULT 'available' CHECK (claim_status IN ('available', 'claimed', 'revoked')),
        claimed_business_id TEXT,
        claimed_iot_device_id TEXT,
        claimed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (claimed_business_id) REFERENCES businesses(id) ON DELETE SET NULL,
        FOREIGN KEY (claimed_iot_device_id) REFERENCES iot_devices(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_iot_inventory_type_status ON iot_device_inventory(device_type, claim_status)`).run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_iot_inventory_claimed_business ON iot_device_inventory(claimed_business_id, device_type)`)
    .run();

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS temperature_sensor_nodes (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        gateway_device_id TEXT NOT NULL,
        node_serial TEXT NOT NULL,
        sensor_id INTEGER NOT NULL,
        display_name TEXT NOT NULL,
        hardware_model TEXT,
        firmware_version TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_seen_at INTEGER,
        battery_mv INTEGER,
        rssi INTEGER,
        revoked_at INTEGER,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (node_serial),
        UNIQUE (business_id, sensor_id),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (gateway_device_id) REFERENCES iot_devices(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_temp_sensor_nodes_business_active ON temperature_sensor_nodes(business_id, is_active, gateway_device_id)`)
    .run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_temp_sensor_nodes_gateway_active ON temperature_sensor_nodes(gateway_device_id, is_active)`)
    .run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_temp_sensor_nodes_business_sensor ON temperature_sensor_nodes(business_id, sensor_id)`)
    .run();

  schemaEnsured = true;
}

async function loadInventory(db: D1, serial: string, deviceType: InventoryRow['device_type']) {
  await ensureTemperatureDeviceProvisioningSchema(db);
  return db
    .prepare(
      `
      SELECT serial, device_type, hardware_model, firmware_version, key_hash, key_prefix,
             claim_status, claimed_business_id, claimed_iot_device_id
      FROM iot_device_inventory
      WHERE serial = ? AND device_type = ?
      LIMIT 1
      `
    )
    .bind(serial, deviceType)
    .first<InventoryRow>();
}

export async function loadTemperatureGateways(db: D1, businessId: string) {
  await ensureTemperatureDeviceProvisioningSchema(db);
  const rows = await db
    .prepare(
      `
      SELECT id, business_id, device_type, external_device_id, display_name, key_prefix,
             is_active, last_seen_at, revoked_at, created_at, updated_at
      FROM iot_devices
      WHERE business_id = ?
        AND device_type = 'sensor_gateway'
      ORDER BY is_active DESC, display_name ASC
      `
    )
    .bind(businessId)
    .all<IoTDeviceRow>();
  return (rows.results ?? []).map(mapIoTDevice);
}

export async function loadTemperatureSensorNodes(db: D1, businessId: string) {
  await ensureTemperatureDeviceProvisioningSchema(db);
  const rows = await db
    .prepare(
      `
      SELECT
        tsn.id,
        tsn.business_id,
        tsn.gateway_device_id,
        gateway.external_device_id AS gateway_serial,
        gateway.display_name AS gateway_name,
        tsn.node_serial,
        tsn.sensor_id,
        tsn.display_name,
        tsn.hardware_model,
        tsn.firmware_version,
        tsn.is_active,
        tsn.last_seen_at,
        tsn.battery_mv,
        tsn.rssi,
        tsn.revoked_at,
        tsn.created_at,
        tsn.updated_at
      FROM temperature_sensor_nodes tsn
      LEFT JOIN iot_devices gateway
        ON gateway.id = tsn.gateway_device_id
      WHERE tsn.business_id = ?
      ORDER BY tsn.is_active DESC, tsn.display_name ASC
      `
    )
    .bind(businessId)
    .all<TemperatureSensorNodeRow>();
  return (rows.results ?? []).map(mapTemperatureSensorNode);
}

export async function claimTemperatureGateway(
  db: D1,
  input: {
    businessId: string;
    serial: string;
    displayName: string;
    createdBy?: string | null;
  }
) {
  await ensureTemperatureDeviceProvisioningSchema(db);
  const serial = normalizeDeviceSerial(input.serial);
  const displayName = input.displayName.trim();
  if (!serial) throw new Error('Gateway serial is required.');
  if (!displayName) throw new Error('Name is required.');

  const now = Math.floor(Date.now() / 1000);
  const existing = await db
    .prepare(
      `
      SELECT id, business_id, device_type, external_device_id, display_name, key_prefix,
             is_active, last_seen_at, revoked_at, created_at, updated_at
      FROM iot_devices
      WHERE external_device_id = ?
      LIMIT 1
      `
    )
    .bind(serial)
    .first<IoTDeviceRow>();

  if (existing) {
    if (existing.business_id !== input.businessId) throw new Error('Gateway serial is already assigned.');
    if (existing.device_type !== 'sensor_gateway') throw new Error('Serial is not a temperature gateway.');
    await db
      .prepare(
        `
        UPDATE iot_devices
        SET display_name = ?, is_active = 1, revoked_at = NULL, updated_at = ?
        WHERE id = ? AND business_id = ?
        `
      )
      .bind(displayName, now, existing.id, input.businessId)
      .run();
    return { id: existing.id, serial };
  }

  const inventory = await loadInventory(db, serial, 'sensor_gateway');
  if (!inventory) throw new Error('Gateway serial is not in device inventory.');
  if (inventory.claim_status === 'revoked') throw new Error('Gateway serial is not available.');
  if (inventory.claimed_business_id && inventory.claimed_business_id !== input.businessId) {
    throw new Error('Gateway serial is already assigned.');
  }
  if (!inventory.key_hash || !inventory.key_prefix) {
    throw new Error('Gateway credentials are not provisioned.');
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `
      INSERT INTO iot_devices (
        id, business_id, device_type, external_device_id, display_name,
        key_hash, key_prefix, is_active, last_seen_at, revoked_at,
        created_by, created_at, updated_at
      )
      VALUES (?, ?, 'sensor_gateway', ?, ?, ?, ?, 1, NULL, NULL, ?, ?, ?)
      `
    )
    .bind(
      id,
      input.businessId,
      serial,
      displayName,
      inventory.key_hash,
      inventory.key_prefix,
      input.createdBy ?? null,
      now,
      now
    )
    .run();

  await db
    .prepare(
      `
      UPDATE iot_device_inventory
      SET claim_status = 'claimed',
          claimed_business_id = ?,
          claimed_iot_device_id = ?,
          claimed_at = COALESCE(claimed_at, ?),
          updated_at = ?
      WHERE serial = ?
      `
    )
    .bind(input.businessId, id, now, now, serial)
    .run();

  return { id, serial };
}

export async function claimTemperatureSensorNode(
  db: D1,
  input: {
    businessId: string;
    gatewayDeviceId: string;
    nodeSerial: string;
    displayName: string;
    createdBy?: string | null;
  }
) {
  await ensureTemperatureDeviceProvisioningSchema(db);
  const nodeSerial = normalizeDeviceSerial(input.nodeSerial);
  const displayName = input.displayName.trim();
  if (!nodeSerial) throw new Error('Sensor serial is required.');
  if (!displayName) throw new Error('Name is required.');

  const gateway = await db
    .prepare(
      `
      SELECT id
      FROM iot_devices
      WHERE id = ?
        AND business_id = ?
        AND device_type = 'sensor_gateway'
        AND is_active = 1
        AND revoked_at IS NULL
      LIMIT 1
      `
    )
    .bind(input.gatewayDeviceId, input.businessId)
    .first<{ id: string }>();
  if (!gateway) throw new Error('Choose an active gateway.');

  const inventory = await loadInventory(db, nodeSerial, 'sensor_node');
  if (!inventory) throw new Error('Sensor serial is not in device inventory.');
  if (inventory.claim_status === 'revoked') throw new Error('Sensor serial is not available.');
  if (inventory.claimed_business_id && inventory.claimed_business_id !== input.businessId) {
    throw new Error('Sensor serial is already assigned.');
  }

  const now = Math.floor(Date.now() / 1000);
  const sensorId = sensorNodeIdFromSerial(nodeSerial);
  const existing = await db
    .prepare(
      `
      SELECT id, business_id
      FROM temperature_sensor_nodes
      WHERE node_serial = ?
      LIMIT 1
      `
    )
    .bind(nodeSerial)
    .first<{ id: string; business_id: string }>();

  if (existing && existing.business_id !== input.businessId) throw new Error('Sensor serial is already assigned.');
  const nodeId = existing?.id ?? crypto.randomUUID();

  await db
    .prepare(
      `
      INSERT INTO temperature_sensor_nodes (
        id, business_id, gateway_device_id, node_serial, sensor_id, display_name,
        hardware_model, firmware_version, is_active, last_seen_at, battery_mv, rssi,
        revoked_at, created_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, NULL, NULL, ?, ?, ?)
      ON CONFLICT(node_serial) DO UPDATE SET
        gateway_device_id = excluded.gateway_device_id,
        display_name = excluded.display_name,
        hardware_model = excluded.hardware_model,
        firmware_version = excluded.firmware_version,
        is_active = 1,
        revoked_at = NULL,
        updated_at = excluded.updated_at
      `
    )
    .bind(
      nodeId,
      input.businessId,
      input.gatewayDeviceId,
      nodeSerial,
      sensorId,
      displayName,
      inventory.hardware_model,
      inventory.firmware_version,
      input.createdBy ?? null,
      now,
      now
    )
    .run();

  await db
    .prepare(
      `
      UPDATE sensor_nodes
      SET name = ?,
          updated_at = ?,
          business_id = ?
      WHERE sensor_id = ?
        AND (business_id = ? OR business_id IS NULL)
      `
    )
    .bind(displayName, now, input.businessId, sensorId, input.businessId)
    .run();

  await db
    .prepare(
      `
      INSERT OR IGNORE INTO sensor_nodes (sensor_id, name, updated_at, business_id)
      VALUES (?, ?, ?, ?)
      `
    )
    .bind(sensorId, displayName, now, input.businessId)
    .run();

  await db
    .prepare(
      `
      UPDATE iot_device_inventory
      SET claim_status = 'claimed',
          claimed_business_id = ?,
          claimed_iot_device_id = ?,
          claimed_at = COALESCE(claimed_at, ?),
          updated_at = ?
      WHERE serial = ?
      `
    )
    .bind(input.businessId, input.gatewayDeviceId, now, now, nodeSerial)
    .run();

  return { id: nodeId, nodeSerial, sensorId };
}

export async function revokeTemperatureSensorNode(db: D1, businessId: string, nodeId: string) {
  await ensureTemperatureDeviceProvisioningSchema(db);
  const node = await db
    .prepare(
      `
      SELECT node_serial, sensor_id
      FROM temperature_sensor_nodes
      WHERE id = ? AND business_id = ?
      LIMIT 1
      `
    )
    .bind(nodeId, businessId)
    .first<{ node_serial: string; sensor_id: number }>();
  if (!node) return;

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
      UPDATE temperature_sensor_nodes
      SET is_active = 0,
          revoked_at = ?,
          updated_at = ?
      WHERE id = ? AND business_id = ?
      `
    )
    .bind(now, now, nodeId, businessId)
    .run();

  await db
    .prepare(
      `
      UPDATE iot_device_inventory
      SET claim_status = 'available',
          claimed_business_id = NULL,
          claimed_iot_device_id = NULL,
          claimed_at = NULL,
          updated_at = ?
      WHERE serial = ?
      `
    )
    .bind(now, node.node_serial)
    .run();
}

export async function resolveGatewayNodeReading(
  db: D1,
  input: {
    businessId: string;
    gatewayDeviceId: string;
    nodeSerial: string;
    temperature: number;
    ts: number;
    batteryMv?: number | null;
    rssi?: number | null;
  }
) {
  await ensureTemperatureDeviceProvisioningSchema(db);
  const nodeSerial = normalizeDeviceSerial(input.nodeSerial);
  if (!nodeSerial) return null;

  const node = await db
    .prepare(
      `
      SELECT sensor_id
      FROM temperature_sensor_nodes
      WHERE business_id = ?
        AND gateway_device_id = ?
        AND node_serial = ?
        AND is_active = 1
        AND revoked_at IS NULL
      LIMIT 1
      `
    )
    .bind(input.businessId, input.gatewayDeviceId, nodeSerial)
    .first<{ sensor_id: number }>();
  if (!node) return null;

  await db
    .prepare(
      `
      UPDATE temperature_sensor_nodes
      SET last_seen_at = ?,
          battery_mv = COALESCE(?, battery_mv),
          rssi = COALESCE(?, rssi),
          updated_at = ?
      WHERE business_id = ?
        AND gateway_device_id = ?
        AND node_serial = ?
      `
    )
    .bind(
      input.ts,
      input.batteryMv ?? null,
      input.rssi ?? null,
      Math.floor(Date.now() / 1000),
      input.businessId,
      input.gatewayDeviceId,
      nodeSerial
    )
    .run();

  return {
    sensor_id: node.sensor_id,
    temperature: input.temperature,
    ts: input.ts
  };
}
