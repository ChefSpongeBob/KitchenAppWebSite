import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createTestD1 } from './helpers/test-d1.mjs';

const file = process.argv[2];
if (!file) throw Error('Provide the path of an existing ignored D1 SQL export. This drill never connects to Cloudflare.');
const source = readFileSync(file, 'utf8');
const restored = createTestD1(source);
try {
  assert.equal(restored.sqlite.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.deepEqual(restored.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  const tables = restored.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  let records = 0;
  const digest = createHash('sha256');
  for (const { name } of tables) {
    const escaped = name.replaceAll('"', '""');
    const rows = restored.sqlite.prepare(`SELECT * FROM "${escaped}"`).all();
    records += rows.length;
    digest.update(JSON.stringify({ table: name, rows }));
  }
  const before = {
    users: restored.sqlite.prepare('SELECT COUNT(*) n FROM users').get().n,
    businesses: restored.sqlite.prepare('SELECT COUNT(*) n FROM businesses').get().n,
    memberships: restored.sqlite.prepare('SELECT COUNT(*) n FROM business_users').get().n
  };
  const preservedRows = new Map(tables.filter(({ name }) => !['platform_staff_passkeys', 'platform_staff_challenges', 'platform_staff_step_up'].includes(name))
    .map(({ name }) => [name, restored.sqlite.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all().map(row => JSON.stringify(row)).sort()]));
  if (restored.sqlite.prepare('PRAGMA table_info(platform_staff_step_up)').all().some(column => column.name === 'passkey_verified_at')) {
    restored.sqlite.exec(readFileSync('migrations/0110_remove_staff_passkeys.sql', 'utf8'));
  }
  restored.sqlite.exec('BEGIN');
  try {
    restored.sqlite.exec(readFileSync('migrations/0111_tenant_content_slug_uniqueness.sql', 'utf8'));
    restored.sqlite.exec('COMMIT');
  } catch (error) { restored.sqlite.exec('ROLLBACK'); throw error; }
  for (const [name, rows] of preservedRows) {
    assert.deepEqual(restored.sqlite.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all().map(row => JSON.stringify(row)).sort(), rows,
      `Migration must preserve every existing row in ${name}`);
  }
  assert.deepEqual({
    users: restored.sqlite.prepare('SELECT COUNT(*) n FROM users').get().n,
    businesses: restored.sqlite.prepare('SELECT COUNT(*) n FROM businesses').get().n,
    memberships: restored.sqlite.prepare('SELECT COUNT(*) n FROM business_users').get().n
  }, before);
  assert.deepEqual(restored.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log(JSON.stringify({ restoredTables: tables.length, restoredRecords: records,
    backupSha256: createHash('sha256').update(source).digest('hex'),
    restoredContentSha256: digest.digest('hex'), integrity: 'ok', foreignKeys: 'ok',
    pendingMigrationPreservesIdentities: true, productionWrites: 0 }, null, 2));
} finally { restored.close(); }
