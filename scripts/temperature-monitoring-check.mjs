import { existsSync, readFileSync } from 'node:fs';

const checks = [];

function read(path) {
  return readFileSync(path, 'utf8');
}

function expect(path, label, predicate) {
  if (!existsSync(path)) {
    checks.push({ ok: false, label, detail: `${path} does not exist.` });
    return;
  }
  const source = read(path);
  checks.push({ ok: Boolean(predicate(source)), label, detail: path });
}

expect('migrations/0078_temperature_monitoring.sql', 'temperature monitoring migration adds settings and alert events', (source) =>
  source.includes('CREATE TABLE IF NOT EXISTS temperature_sensor_settings') &&
  source.includes('CREATE TABLE IF NOT EXISTS temperature_alert_events') &&
  source.includes('high_threshold REAL') &&
  source.includes('low_threshold REAL') &&
  source.includes('stale_after_minutes INTEGER') &&
  source.includes('offline_after_minutes INTEGER') &&
  source.includes('idx_temp_alert_events_business_status')
);

expect('migrations/0086_temperature_gateway_nodes.sql', 'temperature gateway/node migration adds inventory and gateway-owned nodes', (source) =>
  source.includes('CREATE TABLE IF NOT EXISTS iot_device_inventory') &&
  source.includes("device_type IN ('sensor_gateway', 'sensor_node')") &&
  source.includes('CREATE TABLE IF NOT EXISTS temperature_sensor_nodes') &&
  source.includes('gateway_device_id TEXT NOT NULL') &&
    source.includes('UNIQUE (node_serial)')
);

expect('migrations/0093_temperature_humidity.sql', 'temperature humidity migration stores AHT20 humidity', (source) =>
  source.includes('ALTER TABLE temps ADD COLUMN humidity_pct REAL') &&
  source.includes('ALTER TABLE temperature_sensor_nodes ADD COLUMN humidity_pct REAL')
);

expect('migrations/0094_temperature_radio_metadata.sql', 'temperature radio migration stores packet metadata', (source) =>
  source.includes('ALTER TABLE temps ADD COLUMN packet_sequence INTEGER') &&
  source.includes('ALTER TABLE temps ADD COLUMN wake_nonce TEXT') &&
  source.includes('ALTER TABLE temps ADD COLUMN lqi INTEGER') &&
  source.includes('ALTER TABLE temperature_sensor_nodes ADD COLUMN packet_sequence INTEGER') &&
  source.includes('ALTER TABLE temperature_sensor_nodes ADD COLUMN wake_nonce TEXT') &&
  source.includes('ALTER TABLE temperature_sensor_nodes ADD COLUMN lqi INTEGER')
);

expect('src/lib/server/temperatureDeviceProvisioning.ts', 'temperature provisioning claims gateways and assigns radio nodes', (source) =>
  source.includes('claimTemperatureGateway') &&
  source.includes('claimTemperatureSensorNode') &&
  source.includes('resolveGatewayNodeReading') &&
  source.includes('iot_device_inventory') &&
  source.includes('temperature_sensor_nodes') &&
  source.includes('packetSequence') &&
  source.includes('wakeNonce') &&
  source.includes('lqi')
);

expect('src/lib/server/temperatureDeviceProvisioning.ts', 'node registration needs only a unique serial and tenant gateway', (source) =>
  !source.includes("loadInventory(db, nodeSerial, 'sensor_node')") &&
  source.includes('WHERE temperature_sensor_nodes.business_id = excluded.business_id')
);

expect('firmware/arduino/CriminiTempNode/CriminiTempNode.ino', 'standalone node reads AHT20 and deep sleeps', (source) =>
  source.includes('NODE_SERIAL') && source.includes('readAht20') && source.includes('esp_deep_sleep_start')
);

expect('firmware/arduino/CriminiTempNode/CriminiTempNode.ino', 'node signs version 2 radio packets with a separate factory secret', (source) =>
  source.includes('packet.version = 2') &&
  source.includes('RADIO_SECRET') &&
  source.includes('mbedtls_md_hmac') &&
  source.includes('signPacket(packet)') &&
  source.includes('advanceSequence()') &&
  source.includes('storage.putUInt("next_seq"') &&
  source.includes('SLEEP_SECONDS = 300')
);

expect('firmware/arduino/CriminiTempNode/CriminiTempNode.ino', 'node configuration accepts full serials and derives a radio address', (source) =>
  source.includes('const char NODE_SERIAL[] =') &&
  source.includes('const char RADIO_SECRET[] =') &&
  source.includes('radioAddressFromSerial()') &&
  !source.includes('NODE_ADDRESS =')
);

expect('firmware/arduino/CriminiTempGateway/CriminiTempGateway.ino', 'standalone gateway verifies TLS and authenticates uploads', (source) =>
  source.includes('FACTORY_GATEWAY_CREDENTIAL') && source.includes('esp_crt_bundle_attach') &&
  source.includes('"x-device-key"') && !source.includes('setInsecure')
);

expect('firmware/arduino/CriminiTempGateway/CriminiTempGateway.ino', 'gateway verifies radio packets before deduplication and upload', (source) =>
  source.includes('packet.version == 2') &&
  source.includes('mbedtls_md_hmac') &&
  source.includes('verifyPacket(packet) && !seenRecently(packet)') &&
  source.includes('RETRY_INTERVAL_MS = 60000')
);

expect('firmware/arduino/CriminiTempGateway/CriminiTempGateway.ino', 'XIAO gateway selects the external antenna before listening', (source) =>
  source.includes('#ifndef ARDUINO_XIAO_ESP32C6') &&
  source.includes('digitalWrite(WIFI_ENABLE, LOW)') &&
  source.includes('digitalWrite(WIFI_ANT_CONFIG, HIGH)') &&
  source.indexOf('digitalWrite(WIFI_ANT_CONFIG, HIGH)') < source.indexOf('esp_ieee802154_enable()')
);

expect('src/lib/server/temperatureMonitoring.ts', 'temperature helper evaluates thresholds, stale state, acknowledgement, and recovery', (source) =>
  source.includes('evaluateTemperatureReadings') &&
  source.includes('processTemperatureStaleAlerts') &&
  source.includes('acknowledgeTemperatureAlert') &&
  source.includes('saveTemperatureSensorSetting') &&
  source.includes("eventType: `temperature.sensor.${eventType}`") &&
  source.includes("status = 'recovered'")
);

expect('src/routes/api/temps/+server.ts', 'temp ingest evaluates real alert rules after saving readings', (source) =>
  source.includes('evaluateTemperatureReadings') &&
  source.includes('TemperatureReading') &&
  source.includes('humidity_pct') &&
  source.includes('packet_sequence') &&
  source.includes('wake_nonce') &&
  source.includes('lqi') &&
  source.includes("authenticateIoTDevice(db, request, 'sensor_gateway')") &&
  source.includes('resolveGatewayNodeReading') &&
  source.includes('MAX_TEMP_BATCH_SIZE') &&
  source.includes("'Too many readings supplied.'") &&
  source.includes('eventType:') &&
  source.includes('temperature.reading_batch.received')
);

expect('src/routes/api/temps/+server.ts', 'temp ingest does not discard valid rows alongside unregistered nodes or refresh replayed nodes', (source) =>
  source.includes('const rejected = rawReadings.length - items.length') &&
  source.includes('accepted: items.length, rejected, inserted: insertedRows.length') &&
  source.includes('packet_sequence < ?') &&
  source.indexOf('const insertedRows =') < source.indexOf('UPDATE temperature_sensor_nodes')
);

expect('scripts/provision-temperature-gateway.mjs', 'factory provisioning stores a chosen gateway credential hash without generating a secret', (source) =>
  source.includes("process.env.CRIMINI_GATEWAY_CREDENTIAL") &&
  source.includes("loadLocalEnvValue('CRIMINI_GATEWAY_CREDENTIAL')") &&
  source.includes("createHash('sha256')") &&
  source.includes('keyHash.slice(0, 12)') &&
  source.includes('INSERT INTO iot_device_inventory') &&
  source.includes("claim_status = 'available'") &&
  !source.includes('randomBytes')
);

expect('package.json', 'gateway provisioning is available as an explicit operations command', (source) =>
  source.includes('ops:provision-temp-gateway') &&
  source.includes('provision-temperature-gateway.mjs')
);

expect('src/lib/server/temperatureDeviceProvisioning.ts', 'node ingest rejects sequences at or below the last accepted reading', (source) =>
  source.includes('SELECT sensor_id, packet_sequence') &&
  source.includes('input.packetSequence <= node.packet_sequence')
);

expect('src/routes/admin/sensors/+page.server.ts', 'sensor admin loads and saves alert rules', (source) =>
  source.includes('loadTemperatureSensorSettings') &&
  source.includes('claimTemperatureGateway') &&
  source.includes('claimTemperatureSensorNode') &&
  source.includes('saveTemperatureSensorSetting') &&
  source.includes('acknowledgeTemperatureAlert') &&
  source.includes('save_sensor_settings') &&
  source.includes('acknowledge_alert')
);

expect('src/routes/admin/sensors/+page.svelte', 'sensor admin exposes thresholds and active alerts', (source) =>
  source.includes('Register Sensor Node') &&
  source.includes('gateway_device_id') &&
  source.includes('Alert Rules') &&
  source.includes('High') &&
  source.includes('Low') &&
  source.includes('Acknowledge') &&
  source.includes('activeAlerts')
);

expect('src/routes/api/internal/temperature-monitoring/process/+server.ts', 'stale processor is internal-token protected', (source) =>
  source.includes('SMOKE_INTERNAL_TOKEN') &&
  source.includes('processTemperatureStaleAlerts') &&
  source.includes('cache-control')
);

expect('src/lib/server/tenant.ts', 'tenant readiness tracks temperature monitoring tables', (source) =>
  source.includes("'temperature_sensor_nodes'") &&
  source.includes("'temperature_sensor_settings'") &&
  source.includes("'temperature_alert_events'")
);

expect('src/routes/api/internal/schema-readiness/+server.ts', 'schema readiness checks temperature monitoring tables and indexes', (source) =>
  source.includes("'temperature_sensor_nodes'") &&
  source.includes("'iot_device_inventory'") &&
  source.includes("'temperature_sensor_settings'") &&
  source.includes("'temperature_alert_events'") &&
  source.includes("'idx_temp_sensor_nodes_business_active'") &&
  source.includes("'idx_temp_alert_events_business_status'")
);

expect('package.json', 'static suite includes temperature monitoring check', (source) =>
  source.includes('test:temperature-monitoring') &&
  source.includes('temperature-monitoring-check.mjs')
);

expect('docs/PROJECT_HANDOFF.md', 'handoff tracks Phase 5 temperature pass', (source) =>
  source.includes('Temperature hardware uses separate Arduino sketches') &&
  source.includes('Phase 5 hardware pass') &&
  source.includes('Phase 5 remaining needs') &&
  source.includes('sensor ingest')
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
