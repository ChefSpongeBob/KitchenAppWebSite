import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(file, needle, message) {
  const source = read(file);
  if (!source.includes(needle)) {
    throw new Error(`${message}\nMissing in ${file}: ${needle}`);
  }
  console.log(`PASS: ${message}`);
}

function assertNotIncludes(file, needle, message) {
  const source = read(file);
  if (source.includes(needle)) {
    throw new Error(`${message}\nForbidden in ${file}: ${needle}`);
  }
  console.log(`PASS: ${message}`);
}

assertIncludes(
  'src/lib/server/iotIngest.ts',
  'CREATE TABLE IF NOT EXISTS iot_devices',
  'iot device credentials have a dedicated table'
);

assertIncludes(
  'src/lib/server/iotIngest.ts',
  'key_hash TEXT NOT NULL',
  'iot device keys are stored as hashes'
);

assertIncludes(
  'src/lib/server/iotIngest.ts',
  'requestedBusinessId',
  'iot device auth rejects mismatched business context when supplied'
);

for (const file of [
  'src/routes/api/temps/+server.ts',
  'src/routes/api/camera/activity/+server.ts',
  'src/routes/api/camera/upload/+server.ts'
]) {
  assertIncludes(file, 'authenticateIoTDevice', `${file} requires per-device auth`);
  assertNotIncludes(file, 'IOT_API_KEY', `${file} does not use the shared IoT API key`);
  assertNotIncludes(file, 'x-api-key', `${file} does not accept the shared x-api-key auth path`);
}

assertIncludes(
  'src/routes/admin/camera/setup/+page.server.ts',
  'provisionIoTDevice',
  'admins can provision camera device credentials'
);

assertIncludes(
  'src/routes/admin/camera/setup/+page.server.ts',
  'revokeIoTDevice',
  'admins can revoke camera device credentials'
);

assertIncludes(
  'src/routes/admin/sensors/+page.server.ts',
  'claimTemperatureGateway',
  'admins can claim pre-provisioned sensor gateways'
);

assertIncludes(
  'src/routes/admin/sensors/+page.server.ts',
  'claimTemperatureSensorNode',
  'admins can assign radio sensor nodes to gateways'
);

assertIncludes(
  'src/routes/admin/sensors/+page.server.ts',
  'revokeIoTDevice',
  'admins can revoke gateway credentials'
);

assertIncludes(
  'src/routes/admin/sensors/+page.server.ts',
  'revokeTemperatureSensorNode',
  'admins can revoke assigned sensor nodes'
);

assertIncludes(
  'migrations/0052_iot_devices.sql',
  'UNIQUE (business_id, external_device_id)',
  'iot device ids are unique per business'
);

assertIncludes(
  'migrations/0086_temperature_gateway_nodes.sql',
  'CREATE TABLE IF NOT EXISTS iot_device_inventory',
  'factory-programmed device inventory exists'
);

assertIncludes(
  'migrations/0086_temperature_gateway_nodes.sql',
  'CREATE TABLE IF NOT EXISTS temperature_sensor_nodes',
  'temperature sensor nodes are assigned under gateways'
);

console.log('\nIoT device auth check passed.');
