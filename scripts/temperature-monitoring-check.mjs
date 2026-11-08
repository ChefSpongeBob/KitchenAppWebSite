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

expect('migrations/0106_remove_temperature_acknowledgements.sql', 'temperature alerts remove acknowledgement state without losing alert history', (source) =>
  source.includes('CREATE TABLE temperature_alert_events_without_acknowledgements') &&
  source.includes("CASE WHEN status = 'recovered' THEN 'recovered' ELSE 'active' END") &&
  !source.includes('acknowledged_at') &&
  !source.includes('acknowledged_by')
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
  source.includes('WHERE temperature_sensor_nodes.business_id = excluded.business_id') &&
  !source.includes('INSERT OR IGNORE INTO sensor_nodes') &&
  !source.includes('UPDATE sensor_nodes')
);

expect('src/routes/temper/+page.server.ts', 'live temperature labels use the active sensor registry', (source) =>
  source.includes('loadLatestTemperatureSnapshots') &&
  source.includes('nodes: await loadLatestTemperatureSnapshots') &&
  !source.includes('FROM sensor_nodes')
);

expect('src/lib/temperatureTiming.ts', 'node freshness/default continuity use 25 minutes and gateway heartbeats retain 10 minutes', (source) =>
  source.includes('TEMPERATURE_DEFAULT_STALE_MINUTES = 25') &&
  source.includes('TEMPERATURE_ONLINE_WINDOW_SECONDS = TEMPERATURE_DEFAULT_STALE_MINUTES * 60') &&
  source.includes('TEMPERATURE_GATEWAY_ONLINE_WINDOW_SECONDS = 10 * 60')
);

expect('src/lib/server/temperatureMonitoring.ts', 'current temperature state is derived once from the latest sensor contact', (source) =>
  source.includes("from '#lib/temperatureTiming.ts'") &&
  source.includes('deriveTemperatureSnapshotState') &&
  source.includes('last_contact_at: lastContactAt') &&
  source.includes("temperature: connectionStatus === 'online' ? snapshot.temperature : null") &&
  source.includes('temperatureExceptionsFromSnapshots')
);

expect('src/lib/server/reports.ts', 'temperature reports use the authoritative sensor registry', (source) =>
  source.includes('LEFT JOIN temperature_sensor_nodes sn') &&
  source.includes('sn.display_name') &&
  !source.includes('LEFT JOIN sensor_nodes sn')
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
  source.includes('SLEEP_SECONDS = 1200')
);

expect('migrations/0096_temperature_notification_eligibility.sql', 'high temperature alerts gain delayed notification eligibility', (source) =>
  source.includes('notification_ready_at INTEGER') &&
  source.includes('idx_temp_alert_events_notification_ready')
);

expect('firmware/arduino/CriminiTempNode/CriminiTempNode.ino', 'node sends randomized repeated bursts without retaining readings', (source) =>
  source.includes('frameControl = 0x8841') &&
  source.includes('SEND_COUNT = 3') &&
  source.includes('esp_random() % 251') &&
  source.includes('esp_random() % 241') &&
  !source.includes('transmitAcknowledged') &&
  !source.includes('FAST_RETRY_SECONDS')
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

expect('firmware/arduino/CriminiTempGateway/CriminiTempGateway.ino', 'gateway verifies radio packets before deduplication and upload', (source) => {
  const verifiedAt = source.indexOf('if (!verifyPacket(packet))');
  const deduplicatedAt = source.indexOf('if (seenRecently(packet))');
  const retainedAt = source.indexOf('retainLatestReading(packet');
  const destinationFilterAt = source.indexOf('incoming.bytes[6] != (GATEWAY_ADDRESS & 0xFF)');
  const exactLengthFilterAt = source.indexOf('if (incoming.length != expectedLength + 1)');
  return source.includes('packet.version') &&
    source.includes('mbedtls_md_hmac') &&
    verifiedAt >= 0 && deduplicatedAt > verifiedAt && retainedAt > deduplicatedAt &&
    destinationFilterAt >= 0 && exactLengthFilterAt > destinationFilterAt &&
    source.includes('MAX_PENDING_NODES = 25') &&
    source.includes('BATCH_WINDOW_MS = 120000') &&
    source.includes('RADIO_QUIET_PERIOD_MS = 1500') &&
    source.includes('retryScheduled') &&
    source.includes('MAX_FRAMES_PER_LOOP = 32') &&
    source.includes('0x41') &&
    source.includes('0x61') &&
    !source.includes('HEARTBEAT_INTERVAL_MS') &&
    !source.includes('restartGateway()') &&
    source.includes('RETRY_INTERVAL_MS = 60000');
});

expect('src/routes/temper/+page.svelte', 'temperature UI uses the shared node window and requested refrigeration colors', (source) =>
  source.includes('ONLINE_WINDOW_MS = TEMPERATURE_ONLINE_WINDOW_SECONDS * 1000') &&
  source.includes('SAFE_TEMP_LOW_F = 30') &&
  source.includes('SAFE_TEMP_HIGH_F = 41') &&
  source.includes("view=latest") &&
  source.includes("'Online !'") &&
  source.includes('isOnline(lastSeen[node]) && latest[node] !== undefined') &&
  source.includes('Last check-in:') &&
  source.includes('.node-head span.offline') &&
  source.includes('#2563eb')
);

expect('firmware/arduino/CriminiTempGateway/CriminiTempGateway.ino', 'gateway retains measurement age across initial clock sync without radio or persistent-storage changes', (source) =>
  source.includes('int64_t receivedAtUs;') && source.includes('packet, rssi, lqi, esp_timer_get_time()') &&
  source.includes('(esp_timer_get_time() - reading.receivedAtUs) / 1000000LL') &&
  source.includes('time(nullptr) - ageSeconds') && !source.includes('if (reading.receivedAt >=')
);

expect('firmware/arduino/CriminiTempGateway/CriminiTempGateway.ino', 'XIAO gateway selects the external antenna before listening', (source) => {
  const setup = source.slice(source.indexOf('void setup()'));
  return source.includes('#ifndef ARDUINO_XIAO_ESP32C6') &&
    setup.includes('digitalWrite(WIFI_ENABLE, LOW)') &&
    setup.includes('digitalWrite(WIFI_ANT_CONFIG, HIGH)') &&
    setup.indexOf('digitalWrite(WIFI_ANT_CONFIG, HIGH)') < setup.indexOf('resumeRadioReceiver()');
});

expect('src/lib/server/temperatureMonitoring.ts', 'temperature helper evaluates thresholds and delays high notifications for one continuous hour', (source) =>
  source.includes('evaluateTemperatureReadings') &&
  source.includes('processTemperatureStaleAlerts') &&
  source.includes('saveTemperatureSensorSetting') &&
  source.includes('HIGH_NOTIFICATION_DELAY_SECONDS = 60 * 60') &&
  source.includes("input.eventType === 'high' ? now + HIGH_NOTIFICATION_DELAY_SECONDS : null") &&
  source.includes('continuityGapSeconds') &&
  source.includes('FROM temperature_sensor_nodes sn') &&
  source.includes('sensorName: sensorNames.get(reading.sensor_id)') &&
  source.includes("['high', 'low', 'stale', 'offline']") &&
  source.includes("eventType === 'high' ? ['low', 'stale', 'offline']") &&
  source.includes('activeConnectivity') &&
  source.includes("connectivityType === 'offline' ? 'stale' : 'offline'") &&
  source.includes('COALESCE(MAX(sn.last_seen_at), MAX(t.ts)) AS last_reading_ts') &&
  source.includes("['high', 'low', oppositeType]") &&
  source.includes("temperature_alert_events.status != 'active'") &&
  source.includes("status = 'recovered'") &&
  !source.includes('acknowledged') &&
  !source.includes('recordOperationalEventBestEffort')
);

expect('src/routes/api/temps/+server.ts', 'temp ingest evaluates real alert rules after saving readings', (source) =>
  source.includes('evaluateTemperatureReadings') &&
  source.includes('TEMPERATURE_ONLINE_WINDOW_SECONDS') &&
  source.includes('humidity_pct') &&
  source.includes('packet_sequence') &&
  source.includes('wake_nonce') &&
  source.includes('lqi') &&
  source.includes("authenticateIoTDevice(db, request, 'sensor_gateway')") &&
  source.includes('resolveGatewayNodeReading') &&
  source.includes('MAX_TEMP_BATCH_SIZE') &&
  source.includes('MAX_TEMP_BODY_BYTES') &&
  source.includes('MIN_AHT20_TEMPERATURE_F') &&
  source.includes('MAX_AHT20_TEMPERATURE_F') &&
  source.includes("request.headers.get('content-length')") &&
  source.includes("'Too many readings supplied.'") &&
  !source.includes('recordOperationalEventBestEffort') &&
  !source.includes('temperature.reading_batch.received')
);

expect('src/routes/api/temps/+server.ts', 'temp ingest does not discard valid rows alongside unregistered nodes or refresh replayed nodes', (source) =>
  source.includes('const rejected = rawReadings.length - items.length') &&
  source.includes('accepted: insertedRows.length, rejected: rawItems.length - insertedRows.length') &&
  source.includes('packet_sequence < ?') &&
  source.includes('WHERE changes() = 1') && source.includes('await db.batch(statements)')
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
  source.includes('SELECT node_serial, sensor_id, packet_sequence') &&
  source.includes('reading.packetSequence <= node.packet_sequence')
);

expect('src/routes/admin/sensors/+page.server.ts', 'sensor admin loads and saves alert rules', (source) =>
  source.includes('loadTemperatureSensorSettings') &&
  source.includes('claimTemperatureGateway') &&
  source.includes('claimTemperatureSensorNode') &&
  source.includes('saveTemperatureSensorSetting') &&
  source.includes('save_sensor_settings') &&
  !source.includes('acknowledge_alert')
);

expect('src/routes/admin/sensors/+page.svelte', 'sensor admin keeps provisioning and rules separate from live monitoring', (source) =>
  source.includes('Temperature Monitoring Sensors') &&
  source.includes('gateway_device_id') &&
  source.includes('Alert Rules') &&
  source.includes('High') &&
  source.includes('Low') &&
  !source.includes('Acknowledge') &&
  !source.includes('activeAlerts') &&
  !source.includes('Active Alerts')
);

expect('src/routes/admin/+page.server.ts', 'manager temperature exceptions use current snapshots instead of stored alert rows', (source) =>
  source.includes('loadLatestTemperatureSnapshots') &&
  source.includes('temperatureExceptionsFromSnapshots') &&
  source.includes("snapshot.connection_status === 'online'") &&
  !source.includes('loadActiveTemperatureAlerts')
);

expect('src/routes/app/+page.svelte', 'dashboard suppresses old temperatures after a sensor goes offline', (source) =>
  source.includes("node.connectionStatus === 'online'") &&
  source.includes('node.temperature !== null') &&
  source.includes('<span class="offline-reading">Offline</span>')
);

expect('firmware/arduino/CriminiTempGateway/CriminiTempGateway.ino', 'gateway hosts protected Wi-Fi setup for desktop and phone browsers', (source) =>
  source.includes('WiFi.softAP(provisioningServiceName, provisioningProof') &&
  source.includes('WIFI_STORAGE_RAM') &&
  source.includes('Content-Security-Policy') &&
  source.includes('X-Setup-Token') &&
  source.includes('sendGatewayStatus()') &&
  source.includes('provisionWifiIfNeeded()') &&
  source.includes('WiFi.begin()') &&
  !source.includes('WiFiProv') &&
  !source.includes('WIFI_NAME') &&
  !source.includes('WIFI_PASSWORD')
);

expect('src/routes/admin/sensors/+page.svelte', 'registered gateway guidance returns to a tenant-scoped connection check', (source) =>
  source.includes('Connect to Gateway') &&
  source.includes('Set Restaurant Wi-Fi') &&
  source.includes('Check Connection') &&
  source.includes('?/gateway_connection') &&
  source.includes('readGatewaySetupProgress') &&
  !source.includes('GatewayProvisioning.provisionNetwork')
);

expect('firmware/arduino/CriminiTempGateway/GatewaySetupPage.h', 'gateway setup page submits credentials locally and safely renders network names', (source) =>
  source.includes("request('/connect'") &&
  source.includes("new URLSearchParams({ssid,password})") &&
  source.includes("new Option(network,network)") &&
  source.includes("byId('password').value=''") &&
  !source.includes('innerHTML') &&
  !source.includes('https://')
);

expect('android/app/src/main/AndroidManifest.xml', 'gateway setup no longer requests Android Bluetooth permissions', (source) =>
  !source.includes('BLUETOOTH') && !source.includes('ACCESS_FINE_LOCATION')
);

expect('ios/App/App/Info.plist', 'gateway setup no longer requests iOS Bluetooth permissions', (source) =>
  !source.includes('NSBluetoothAlwaysUsageDescription')
);

expect('src/routes/api/internal/temperature-monitoring/process/+server.ts', 'stale processor is internal-token protected', (source) =>
  source.includes('SMOKE_INTERNAL_TOKEN') &&
  source.includes('processTemperatureStaleAlerts') &&
  source.includes('MAX_BUSINESS_BATCH = 25') &&
  source.includes('businessIds') &&
  source.includes('cache-control')
);

expect('workers/operational-email-dispatcher/index.js', 'scheduled dispatcher processes active temperature tenants in bounded batches', (source) =>
  source.includes('/api/internal/temperature-monitoring/process') &&
  source.includes('FROM temperature_sensor_nodes') &&
  source.includes('offset += 25') &&
  source.includes('scheduledMinute % 5 === 0')
);

expect('workers/operational-email-dispatcher/wrangler.jsonc', 'scheduled dispatcher has the production D1 binding', (source) =>
  source.includes('"binding": "DB"') &&
  source.includes('"database_name": "crimini-production"')
);

expect('src/hooks.server.ts', 'temperature service routes separate protected reads from device and scheduler posts', (source) =>
  source.includes("pathname === '/api/internal/temperature-monitoring/process'") &&
  source.includes("pathname === '/api/temps' && event.request.method === 'POST'") &&
  !source.includes("pathname.startsWith('/api/temps')")
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

await import('./gateway-wifi-behavior-check.mjs');
await import('./temperature-ingest-behavior-check.mjs');
await import('./temperature-runtime-check.mjs');
