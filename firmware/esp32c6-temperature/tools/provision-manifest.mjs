#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  })
);

const prefix = String(args.prefix || 'crimini').toLowerCase().replace(/[^a-z0-9-]/g, '-');
const gatewayCount = Math.max(1, Number(args.gateways || 1));
const nodesPerGateway = Math.max(1, Number(args.nodes || 4));
const hardwareGateway = String(args.gatewayHardware || 'esp32c6-gateway');
const hardwareNode = String(args.nodeHardware || 'esp32c6-ds18b20-node');
const firmwareVersion = String(args.firmware || '0.1.0');
const outputDir = String(args.out || 'firmware/esp32c6-temperature/generated');
const now = Math.floor(Date.now() / 1000);

function serial(kind, index) {
  return `${prefix}-${kind}-${String(index).padStart(4, '0')}`;
}

function secret(label) {
  return `${label}_${randomBytes(32).toString('hex')}`;
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

mkdirSync(outputDir, { recursive: true });

const sql = [];
const configs = [];
sql.push('-- Generated Crimini IoT inventory. Review before applying to D1.');
sql.push('-- Apply with: npx wrangler d1 execute crimini-production --remote --file <this-file>');
sql.push('');

for (let gatewayIndex = 1; gatewayIndex <= gatewayCount; gatewayIndex += 1) {
  const gatewaySerial = serial('gateway', gatewayIndex);
  const gatewayKey = secret('sknns_iot');
  const gatewayKeyHash = sha256Hex(gatewayKey);
  const gatewayKeyPrefix = gatewayKey.slice(0, 18);
  const knownNodes = [];

  sql.push(`INSERT INTO iot_device_inventory (`);
  sql.push(`  serial, device_type, hardware_model, firmware_version, key_hash, key_prefix, claim_status, created_at, updated_at`);
  sql.push(`) VALUES (`);
  sql.push(`  ${sqlString(gatewaySerial)}, 'sensor_gateway', ${sqlString(hardwareGateway)}, ${sqlString(firmwareVersion)}, ${sqlString(gatewayKeyHash)}, ${sqlString(gatewayKeyPrefix)}, 'available', ${now}, ${now}`);
  sql.push(`) ON CONFLICT(serial) DO UPDATE SET`);
  sql.push(`  hardware_model = excluded.hardware_model,`);
  sql.push(`  firmware_version = excluded.firmware_version,`);
  sql.push(`  key_hash = excluded.key_hash,`);
  sql.push(`  key_prefix = excluded.key_prefix,`);
  sql.push(`  updated_at = excluded.updated_at;`);
  sql.push('');

  for (let nodeOffset = 1; nodeOffset <= nodesPerGateway; nodeOffset += 1) {
    const globalNodeIndex = (gatewayIndex - 1) * nodesPerGateway + nodeOffset;
    const nodeSerial = serial('sensor', globalNodeIndex);
    const nodeSecret = secret('crimini_node');
    knownNodes.push({ serial: nodeSerial, secret: nodeSecret });

    sql.push(`INSERT INTO iot_device_inventory (`);
    sql.push(`  serial, device_type, hardware_model, firmware_version, key_hash, key_prefix, claim_status, created_at, updated_at`);
    sql.push(`) VALUES (`);
    sql.push(`  ${sqlString(nodeSerial)}, 'sensor_node', ${sqlString(hardwareNode)}, ${sqlString(firmwareVersion)}, NULL, NULL, 'available', ${now}, ${now}`);
    sql.push(`) ON CONFLICT(serial) DO UPDATE SET`);
    sql.push(`  hardware_model = excluded.hardware_model,`);
    sql.push(`  firmware_version = excluded.firmware_version,`);
    sql.push(`  updated_at = excluded.updated_at;`);
    sql.push('');
  }

  configs.push({ gatewaySerial, gatewayKey, knownNodes });
}

writeFileSync(join(outputDir, 'iot_inventory.sql'), `${sql.join('\n')}\n`);
writeFileSync(join(outputDir, 'factory_manifest.json'), `${JSON.stringify(configs, null, 2)}\n`);

for (const [index, config] of configs.entries()) {
  const nodeList = config.knownNodes
    .map((node) => `  { "${node.serial}", "${node.secret}" }`)
    .join(',\n');
  const header = `// Generated secrets. Do not commit.\n#pragma once\n\n#define CRIMINI_GATEWAY_SERIAL "${config.gatewaySerial}"\n#define CRIMINI_GATEWAY_DEVICE_KEY "${config.gatewayKey}"\n\nstatic const CriminiKnownNode CRIMINI_KNOWN_NODES[] = {\n${nodeList}\n};\n`;
  writeFileSync(join(outputDir, `gateway-${index + 1}-secrets.h`), header);

  for (const node of config.knownNodes) {
    const nodeHeader = `// Generated secrets. Do not commit.\n#pragma once\n\n#define CRIMINI_NODE_SERIAL "${node.serial}"\n#define CRIMINI_NODE_SHARED_SECRET "${node.secret}"\n`;
    writeFileSync(join(outputDir, `${node.serial}-secrets.h`), nodeHeader);
  }
}

console.log(`Wrote ${join(outputDir, 'iot_inventory.sql')}`);
console.log(`Wrote ${join(outputDir, 'factory_manifest.json')}`);
console.log('Generated gateway/node secret header snippets. Keep generated/ out of git.');
