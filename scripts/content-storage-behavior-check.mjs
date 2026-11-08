import assert from 'node:assert/strict';
import { createTestD1, loadServerModules } from './helpers/test-d1.mjs';

const test = createTestD1();
const { sqlite, db } = test;
const now = Math.floor(Date.now() / 1000);
const load = loadServerModules();
const admin = load('src/lib/server/admin.ts');
const objects = new Set();
const removed = [];
const bucket = { async put(key) { objects.add(key); }, async delete(key) { removed.push(key); objects.delete(key); } };
const locals = { DB: db, MEDIA_BUCKET: bucket, businessId: 'a', userId: 'owner-a', userRole: 'admin', businessRole: 'owner', businessPermissionTemplate: 'owner' };
const oldKey = 'businesses/a/documents/original.pdf';
const foreignKey = 'businesses/b/documents/private.pdf';
const oldUrl = `/api/documents/media/${oldKey}`;
function insert(table, row) {
  const fields = Object.keys(row);
  sqlite.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...Object.values(row));
}
function request(fields, upload = true) {
  const body = new FormData();
  for (const [key, value] of Object.entries({ id: 'doc-a', title: 'Handbook', slug: 'handbook', category: 'Kitchen', section: 'Docs', file_url: oldUrl, ...fields })) body.set(key, value);
  if (upload) body.set('file', new File(['%PDF-fixture'], 'handbook.pdf', { type: 'application/pdf' }));
  return new Request('https://criminiops.com/admin/creator', { method: 'POST', body });
}
try {
  for (const business of ['a', 'b']) insert('businesses', { id: business, name: business, slug: business, created_at: now, updated_at: now });
  insert('documents', { id: 'doc-a', business_id: 'a', title: 'Handbook', slug: 'handbook', section: 'Docs', category: 'Kitchen', file_url: oldUrl, created_at: now, updated_at: now });
  objects.add(oldKey); objects.add(foreignKey);
  sqlite.exec("CREATE TRIGGER test_document_failure BEFORE UPDATE ON documents BEGIN SELECT RAISE(ABORT,'document rollback'); END");
  await assert.rejects(admin.updateDocument(request({ existing_file_url: `/api/documents/media/${foreignKey}` }), locals), /document rollback/);
  assert.equal(sqlite.prepare("SELECT file_url FROM documents WHERE id='doc-a'").get().file_url, oldUrl);
  assert.deepEqual(objects, new Set([oldKey, foreignKey]), 'Failed D1 update must preserve old files and clean the newly uploaded orphan');
  sqlite.exec('DROP TRIGGER test_document_failure');
  assert.equal((await admin.updateDocument(request({ existing_file_url: `/api/documents/media/${foreignKey}` }), locals)).success, true);
  assert.equal(objects.has(oldKey), false, 'Only the authoritative old document media is cleaned after successful D1 update');
  assert.equal(objects.has(foreignKey), true, 'Submitted existing_file_url must never authorize another tenant media deletion');
  const savedUrl = sqlite.prepare("SELECT file_url FROM documents WHERE id='doc-a'").get().file_url;
  const savedKey = savedUrl.replace('/api/documents/media/', '');
  insert('documents', { id: 'shared-a', business_id: 'a', title: 'Shared', slug: 'shared', section: 'Docs', category: 'Kitchen', file_url: savedUrl, created_at: now, updated_at: now });
  assert.equal((await admin.updateDocument(request({}), locals)).success, true);
  assert.equal(objects.has(savedKey), true, 'A file still referenced by another document must be preserved');
  const before = new Set(objects);
  sqlite.exec("CREATE TRIGGER test_document_create_failure BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT,'create rollback'); END");
  await assert.rejects(admin.createDocument(request({ slug: 'new-handbook' }), locals), /create rollback/);
  assert.deepEqual(objects, before, 'Failed creation cleans its new upload without touching saved media');
  sqlite.exec('DROP TRIGGER test_document_create_failure');
  assert.equal((await admin.updateDocument(request({ id: 'missing' }), locals)).status, 404);
  assert.equal((await admin.updateDocument(request({ id: 'doc-a' }), { ...locals, businessId: 'b' })).status, 404);
  assert.equal(objects.has(foreignKey), true);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS document replacement: authoritative tenant lookup, DB-failure preservation, new-upload rollback cleanup, shared-file safety and no cross-tenant R2 deletion');
} finally { test.close(); }
