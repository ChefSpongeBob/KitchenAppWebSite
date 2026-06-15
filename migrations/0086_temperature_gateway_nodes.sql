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
);

CREATE INDEX IF NOT EXISTS idx_iot_inventory_type_status
  ON iot_device_inventory(device_type, claim_status);

CREATE INDEX IF NOT EXISTS idx_iot_inventory_claimed_business
  ON iot_device_inventory(claimed_business_id, device_type);

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
);

CREATE INDEX IF NOT EXISTS idx_temp_sensor_nodes_business_active
  ON temperature_sensor_nodes(business_id, is_active, gateway_device_id);

CREATE INDEX IF NOT EXISTS idx_temp_sensor_nodes_gateway_active
  ON temperature_sensor_nodes(gateway_device_id, is_active);

CREATE INDEX IF NOT EXISTS idx_temp_sensor_nodes_business_sensor
  ON temperature_sensor_nodes(business_id, sensor_id);
