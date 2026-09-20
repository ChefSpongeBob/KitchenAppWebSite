#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, '..', 'generated');
const template = readFileSync(join(here, '..', 'CriminiTemperature', 'CriminiLocalConfig.example.h'), 'utf8');
const options = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const prefix = String(options.prefix ?? 'crimini').toLowerCase();
const gatewayCount = Number(options.gateways ?? 1);
const nodesPerGateway = Number(options.nodes ?? 4);

if (!/^[a-z0-9-]{1,8}$/.test(prefix) ||
    !Number.isInteger(gatewayCount) || gatewayCount < 1 || gatewayCount > 20 ||
    !Number.isInteger(nodesPerGateway) || nodesPerGateway < 1 || nodesPerGateway > 64) {
  throw new Error('Use --prefix=letters-numbers --gateways=1..20 --nodes=1..64');
}

function serial(kind) {
  return `${prefix}-${kind}-${randomBytes(7).toString('hex')}`;
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function setMacro(config, name, value) {
  const expression = new RegExp(`^#define ${name} .*$`, 'm');
  if (!expression.test(config)) throw new Error(`Missing config macro ${name}`);
  return config.replace(expression, `#define ${name} ${JSON.stringify(value)}`);
}

function writeConfig(filename, serialNumber, secret, isGateway, nodes = []) {
  let config = template.replace('#define CRIMINI_ROLE_GATEWAY 0',
    `#define CRIMINI_ROLE_GATEWAY ${isGateway ? 1 : 0}`);
  config = setMacro(config, isGateway ? 'CRIMINI_GATEWAY_SERIAL' : 'CRIMINI_NODE_SERIAL', serialNumber);
  config = setMacro(config, isGateway ? 'CRIMINI_GATEWAY_DEVICE_KEY' : 'CRIMINI_NODE_SECRET', secret);
  if (isGateway) {
    const entries = nodes.map((node) => `  { ${JSON.stringify(node.serial)}, ${JSON.stringify(node.secret)} }`).join(',\n');
    config = config.replace(/static const CriminiKnownNode CRIMINI_KNOWN_NODES\[\] = \{[\s\S]*?\};/,
      `static const CriminiKnownNode CRIMINI_KNOWN_NODES[] = {\n${entries}\n};`);
  }
  writeFileSync(join(output, filename), config);
}

if (existsSync(join(output, 'factory_manifest.json'))) {
  throw new Error('Factory manifest already exists. Preserve or archive generated/ before making another batch.');
}
mkdirSync(output, { recursive: true });
const generatedAt = Math.floor(Date.now() / 1000);
const sqlLines = ['-- Factory inventory. Run once; duplicate serials must fail.', ''];
const manifest = [];
for (let gatewayIndex = 0; gatewayIndex < gatewayCount; ++gatewayIndex) {
  const gatewaySerial = serial('gateway');
  const gatewayKey = `sknns_iot_${randomBytes(32).toString('hex')}`;
  const nodes = [];
  sqlLines.push(`INSERT INTO iot_device_inventory (serial, device_type, hardware_model, firmware_version, key_hash, key_prefix, claim_status, created_at, updated_at) VALUES (${sql(gatewaySerial)}, 'sensor_gateway', 'esp32c6-802154-wifi-gateway', '1.0.0', ${sql(createHash('sha256').update(gatewayKey).digest('hex'))}, ${sql(gatewayKey.slice(0, 18))}, 'available', ${generatedAt}, ${generatedAt});`);
  for (let nodeIndex = 0; nodeIndex < nodesPerGateway; ++nodeIndex) {
    const nodeSerial = serial('sensor');
    const nodeSecret = `crimini_node_${randomBytes(32).toString('hex')}`;
    nodes.push({ serial: nodeSerial, secret: nodeSecret });
    sqlLines.push(`INSERT INTO iot_device_inventory (serial, device_type, hardware_model, firmware_version, key_hash, key_prefix, claim_status, created_at, updated_at) VALUES (${sql(nodeSerial)}, 'sensor_node', 'esp32c6fh4-aht20-bmp280-node', '1.0.0', NULL, NULL, 'available', ${generatedAt}, ${generatedAt});`);
    writeConfig(`sensor-${gatewayIndex + 1}-${nodeIndex + 1}.h`, nodeSerial, nodeSecret, false);
  }
  writeConfig(`gateway-${gatewayIndex + 1}.h`, gatewaySerial, gatewayKey, true, nodes);
  manifest.push({ gatewaySerial, gatewayKey, nodes });
}

writeFileSync(join(output, 'iot_inventory.sql'), `${sqlLines.join('\n')}\n`);
writeFileSync(join(output, 'factory_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${gatewayCount} gateway(s) and ${gatewayCount * nodesPerGateway} node(s) in firmware/arduino/generated`);
console.log('Keep generated/ private. Set board GPIOs, gateway Wi-Fi and TLS CA before flashing.');
