import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = new Map();
const flags = new Set();

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--') && arg.includes('=')) {
    const [key, ...rest] = arg.slice(2).split('=');
    args.set(key, rest.join('='));
  } else if (arg.startsWith('--')) {
    flags.add(arg.slice(2));
  }
}

function usage(exitCode = 1) {
  console.log([
    'Usage:',
    '  $env:CRIMINI_GATEWAY_CREDENTIAL="your factory credential"',
    '  npm run ops:provision-temp-gateway -- --remote --serial=gateway-0001 --confirm=provision-temperature-gateway',
    '',
    'The command records your assigned serial and a SHA-256 credential hash.',
    'It never generates a serial or stores the plaintext credential in D1.',
    '',
    'Options:',
    '  --remote | --local                         Required D1 target.',
    '  --serial=<assigned gateway serial>          Required; lowercase letters, numbers, hyphens, underscores.',
    '  --hardware=<model>                          Optional; defaults to seeed-xiao-esp32c6.',
    '  --firmware=<version>                        Optional; defaults to 2.0.0.',
    '  --confirm=provision-temperature-gateway     Required safety confirmation.'
  ].join('\n'));
  process.exit(exitCode);
}

function loadLocalEnvValue(name) {
  for (const file of ['.dev.vars', '.env.production.local']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (/^\s*#/.test(line) || !line.includes('=')) continue;
      const [rawKey, ...rest] = line.split('=');
      if (rawKey.trim() === name) return rest.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

function loadCloudflareToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return;
  const token = loadLocalEnvValue('CLOUDFLARE_API_TOKEN');
  if (token) process.env.CLOUDFLARE_API_TOKEN = token;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

if (flags.has('help') || flags.has('h')) usage(0);

const useRemote = flags.has('remote');
const useLocal = flags.has('local');
const serial = String(args.get('serial') ?? '').trim();
const credential = String(
  process.env.CRIMINI_GATEWAY_CREDENTIAL || loadLocalEnvValue('CRIMINI_GATEWAY_CREDENTIAL')
);
const hardwareModel = String(args.get('hardware') ?? 'seeed-xiao-esp32c6').trim();
const firmwareVersion = String(args.get('firmware') ?? '2.0.0').trim();
const confirm = String(args.get('confirm') ?? '');

if (useRemote === useLocal) usage();
if (!/^[a-z0-9][a-z0-9_-]{0,30}$/.test(serial)) {
  console.error('Gateway serial must be 1-31 lowercase letters, numbers, hyphens, or underscores.');
  process.exit(1);
}
if (credential.length < 32) {
  console.error('Set CRIMINI_GATEWAY_CREDENTIAL to the same 32+ character value flashed into the gateway.');
  process.exit(1);
}
if (!hardwareModel || !firmwareVersion) usage();
if (confirm !== 'provision-temperature-gateway') usage();

loadCloudflareToken();
if (useRemote && !process.env.CLOUDFLARE_API_TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN is not available in the environment, .dev.vars, or .env.production.local.');
  process.exit(1);
}

const keyHash = createHash('sha256').update(credential, 'utf8').digest('hex');
const keyPrefix = keyHash.slice(0, 12);
const now = Math.floor(Date.now() / 1000);
const target = useRemote ? '--remote' : '--local';
const wrangler = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function runWrangler(command, capture = false) {
  return spawnSync(
    process.execPath,
    [wrangler, 'd1', 'execute', 'crimini-production', target, '--command', command, ...(capture ? ['--json'] : [])],
    {
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      encoding: capture ? 'utf8' : undefined,
      shell: false,
      env: process.env
    }
  );
}

function queryOne(command) {
  const result = runWrangler(command, true);
  if (result.status !== 0) {
    if (result.stderr) console.error(result.stderr.trim());
    throw new Error('Production D1 query failed.');
  }
  const payload = JSON.parse(result.stdout || '[]');
  return payload?.[0]?.results?.[0] ?? null;
}

const before = queryOne(`
  SELECT serial, device_type, claim_status, claimed_business_id, claimed_iot_device_id
  FROM iot_device_inventory
  WHERE serial = ${sqlString(serial)}
  LIMIT 1
`);

if (before && (
  before.device_type !== 'sensor_gateway' ||
  before.claim_status !== 'available' ||
  before.claimed_business_id ||
  before.claimed_iot_device_id
)) {
  console.error('Gateway provisioning refused because this serial is already claimed, revoked, or assigned to another device type.');
  process.exit(1);
}

const mutation = `
INSERT INTO iot_device_inventory (
  serial, device_type, hardware_model, firmware_version,
  key_hash, key_prefix, claim_status,
  claimed_business_id, claimed_iot_device_id, claimed_at,
  created_at, updated_at
)
VALUES (
  ${sqlString(serial)}, 'sensor_gateway', ${sqlString(hardwareModel)}, ${sqlString(firmwareVersion)},
  ${sqlString(keyHash)}, ${sqlString(keyPrefix)}, 'available',
  NULL, NULL, NULL, ${now}, ${now}
)
ON CONFLICT(serial) DO UPDATE SET
  hardware_model = excluded.hardware_model,
  firmware_version = excluded.firmware_version,
  key_hash = excluded.key_hash,
  key_prefix = excluded.key_prefix,
  updated_at = excluded.updated_at
WHERE iot_device_inventory.device_type = 'sensor_gateway'
  AND iot_device_inventory.claim_status = 'available'
  AND iot_device_inventory.claimed_business_id IS NULL
  AND iot_device_inventory.claimed_iot_device_id IS NULL
`;

const result = runWrangler(mutation);
if (result.status !== 0) {
  if (result.error) console.error(result.error.message);
  console.error('Gateway provisioning failed. Claimed and revoked serials cannot be overwritten.');
  process.exit(result.status ?? 1);
}

const saved = queryOne(`
  SELECT serial, device_type, hardware_model, firmware_version, key_hash, key_prefix,
         claim_status, claimed_business_id, claimed_iot_device_id
  FROM iot_device_inventory
  WHERE serial = ${sqlString(serial)}
  LIMIT 1
`);

if (!saved || saved.device_type !== 'sensor_gateway' || saved.claim_status !== 'available' ||
    saved.claimed_business_id || saved.claimed_iot_device_id ||
    saved.key_hash !== keyHash || saved.key_prefix !== keyPrefix) {
  console.error('Gateway provisioning verification failed; the saved inventory record does not match.');
  process.exit(1);
}

console.log(`Gateway ${serial} is available for serial-only registration in the app.`);
