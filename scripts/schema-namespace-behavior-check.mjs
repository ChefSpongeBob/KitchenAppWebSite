import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const test = createTestD1(readFileSync('scripts/fixtures/current-schema.sql','utf8'));
const { sqlite } = test;
const migration = readFileSync('migrations/0111_tenant_content_slug_uniqueness.sql','utf8');
function insert(table, fields) {
  const keys = Object.keys(fields);
  sqlite.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?')})`).run(...Object.values(fields));
}
const tables = ['checklist_sections','checklist_items','list_sections','list_items','documents'];
const rows = () => new Map(tables.map(table => [table, sqlite.prepare(`SELECT * FROM ${table}`).all()]));
try {
  for (const { name } of sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
    assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM "${name.replaceAll('"','""')}"`).get().n, 0, `Schema fixture must not contain stored rows: ${name}`);
  }
  insert('checklist_sections', { id:'check-a',business_id:'a',slug:'closing',title:'Closing',created_at:1,updated_at:1 });
  insert('checklist_items', { id:'check-item',business_id:'a',section_id:'check-a',content:'Lock doors',created_at:1,updated_at:1 });
  insert('list_sections', { id:'list-a',business_id:'a',slug:'daily',domain:'preplists',title:'Daily',created_at:1,updated_at:1 });
  insert('list_items', { id:'prep-item',business_id:'a',section_id:'list-a',content:'Rice',created_at:1,updated_at:1 });
  insert('documents', { id:'doc-a',business_id:'a',slug:'handbook',title:'Handbook',section:'docs',category:'Policy',file_url:'/api/documents/media/businesses/a/test.pdf',created_at:1,updated_at:1 });
  const before = rows();
  sqlite.exec('BEGIN');
  try {
    sqlite.exec(migration);
    sqlite.exec('SELECT force_migration_rollback FROM missing_test_table');
    assert.fail('The injected migration error must fail');
  } catch { sqlite.exec('ROLLBACK'); }
  assert.deepEqual(rows(),before);
  assert.ok(sqlite.prepare("SELECT sql FROM sqlite_master WHERE name='checklist_sections'").get().sql.includes('slug TEXT NOT NULL UNIQUE'));
  sqlite.exec('BEGIN');
  sqlite.exec(migration);
  sqlite.exec('COMMIT');
  assert.deepEqual(rows(),before, 'Every parent/child value and file reference must be preserved');
  for (const [table, row] of [
    ['checklist_sections',{id:'check-b',business_id:'b',slug:'closing',title:'Closing',created_at:1,updated_at:1}],
    ['list_sections',{id:'list-b',business_id:'b',slug:'daily',domain:'preplists',title:'Daily',created_at:1,updated_at:1}],
    ['documents',{id:'doc-b',business_id:'b',slug:'handbook',title:'Handbook',section:'docs',category:'Policy',created_at:1,updated_at:1}]
  ]) {
    insert(table,row);
    assert.throws(() => insert(table,{...row,id:row.id+'-duplicate'}),/UNIQUE constraint/);
  }
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE '_migration0111_%'").get().n,0);
  const allowedGlobal = new Set(['business_invites:invite_code', 'iot_devices:external_device_id',
    'temperature_sensor_nodes:node_serial', 'schedule_shift_offers:shift_id', 'schedule_open_shift_requests:open_shift_id,requested_by_user_id']);
  for (const { name } of sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
    if (!sqlite.prepare(`PRAGMA table_info("${name}")`).all().some(column => column.name === 'business_id')) continue;
    for (const index of sqlite.prepare(`PRAGMA index_list("${name}")`).all()) {
      if (!index.unique || index.origin === 'pk') continue;
      const columns = sqlite.prepare(`PRAGMA index_info("${index.name}")`).all().map(column => column.name);
      if (columns.includes('business_id') || columns.join(',') === 'id') continue;
      assert.ok(allowedGlobal.has(name + ':' + columns.join(',')), `Unreviewed global unique constraint in tenant table ${name}: ${columns}`);
    }
  }
  sqlite.exec(readFileSync('migrations/0112_staff_email_verification.sql','utf8'));
  sqlite.exec(readFileSync('migrations/0113_staff_diagnostics_dashboard.sql','utf8'));
  const readiness = loadServerModules({ '#lib/server/observability.ts': { logOperationalEvent() {} } })('src/routes/api/internal/schema-readiness/+server.ts');
  const check = await readiness.GET({ locals: { DB: test.db, env: { SMOKE_INTERNAL_TOKEN: 'test-internal-token' } },
    request: new Request('https://criminiops.com/api/internal/schema-readiness', { headers: { 'x-smoke-token': 'test-internal-token' } }) });
  const payload = await check.json();
  for (const name of ['idx_checklist_sections_business_slug','idx_list_sections_business_domain_slug','idx_documents_business_slug_active']) {
    assert.equal(payload.missingCoreIndexes.includes(name),false);
  }
  sqlite.exec('DROP INDEX idx_checklist_sections_business_slug; CREATE INDEX idx_checklist_sections_business_slug ON checklist_sections(business_id, slug)');
  const invalid = await readiness.GET({ locals: { DB: test.db, env: { SMOKE_INTERNAL_TOKEN: 'test-internal-token' } },
    request: new Request('https://criminiops.com/api/internal/schema-readiness', { headers: { 'x-smoke-token': 'test-internal-token' } }) });
  assert.ok((await invalid.json()).missingCoreIndexes.includes('idx_checklist_sections_business_slug'), 'An index name alone must not pass readiness');
  console.log('PASS content-namespace migration: rollback is atomic, existing child rows/URLs preserved, identical names allowed across tenants and rejected within each tenant');
} finally { test.close(); }
