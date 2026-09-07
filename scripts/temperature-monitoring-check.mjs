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
  source.includes('Temperature hardware model now targets ESP32-C6FH4 AHT20/BMP280 sensor nodes') &&
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
