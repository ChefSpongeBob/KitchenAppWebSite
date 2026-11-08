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
  await assert.rejects(admin.updateDocument(request({ existing_file_url: oldUrl }), locals), /document rollback/);
  assert.equal(sqlite.prepare("SELECT file_url FROM documents WHERE id='doc-a'").get().file_url, oldUrl);
  assert.deepEqual(objects, new Set([oldKey, foreignKey]), 'Failed D1 update must preserve old files and clean the newly uploaded orphan');
  sqlite.exec('DROP TRIGGER test_document_failure');
  assert.equal((await admin.updateDocument(request({ existing_file_url: `/api/documents/media/${foreignKey}` }), locals)).status, 409);
  assert.equal((await admin.updateDocument(request({ existing_file_url: oldUrl }), locals)).success, true);
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

  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const beginPausedUpload = fields => {
    const started = deferred(); const release = deferred();
    const pending = admin.updateDocument(request(fields), { ...locals, MEDIA_BUCKET: { ...bucket,
      async put(key) { await bucket.put(key); started.resolve(key); await release.promise; }
    } });
    return { started: started.promise, release: release.resolve, pending };
  };
  const first = beginPausedUpload({ title: 'First replacement' });
  const firstKey = await first.started;
  assert.equal((await admin.updateDocument(request({ title: 'Winning replacement' }), locals)).success, true);
  const winner = sqlite.prepare("SELECT file_url FROM documents WHERE id='doc-a'").get().file_url;
  first.release();
  assert.equal((await first.pending).status, 409);
  assert.equal(sqlite.prepare("SELECT file_url FROM documents WHERE id='doc-a'").get().file_url, winner);
  assert.equal(objects.has(firstKey), false, 'The losing upload is cleaned, not the winning one');
  assert.equal(objects.has(winner.replace('/api/documents/media/', '')), true);
  assert.equal((await admin.updateDocument(request({ existing_file_url: oldUrl, file_url: oldUrl }, false), locals)).status, 409);
  assert.equal(sqlite.prepare("SELECT file_url FROM documents WHERE id='doc-a'").get().file_url, winner, 'A stale form cannot restore a removed file');

  const edited = beginPausedUpload({ title: 'Must not overwrite concurrent metadata' });
  const editedKey = await edited.started;
  sqlite.exec("UPDATE documents SET title='Concurrent metadata edit' WHERE id='doc-a'");
  edited.release();
  assert.equal((await edited.pending).status, 409, 'Same-second metadata edits must also be detected');
  assert.equal(objects.has(editedKey), false);

  insert('list_sections', { id: 'section-a', business_id: 'a', domain: 'preplists', slug: 'daily', title: 'Daily', created_at: now, updated_at: now });
  insert('list_items', { id: 'item-a', business_id: 'a', section_id: 'section-a', content: 'Prep', created_at: now, updated_at: now });
  insert('item_attachments', { id: 'attachment-a', business_id: 'a', source_type: 'list_item', source_item_id: 'item-a', target_type: 'document', target_id: 'doc-a', created_at: now });
  sqlite.exec("CREATE TRIGGER test_document_delete_failure BEFORE DELETE ON documents WHEN OLD.id='doc-a' BEGIN SELECT RAISE(ABORT,'delete rollback'); END");
  await assert.rejects(admin.deleteDocument(request({}, false), locals), /delete rollback/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM item_attachments WHERE id='attachment-a'").get().n, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM documents WHERE id='doc-a'").get().n, 1);
  sqlite.exec('DROP TRIGGER test_document_delete_failure');
  const deleting = beginPausedUpload({ title: 'Deleted during upload' });
  const deletingKey = await deleting.started;
  assert.equal((await admin.deleteDocument(request({}, false), locals)).success, true);
  deleting.release();
  assert.equal((await deleting.pending).status, 409);
  assert.equal(objects.has(deletingKey), false);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM documents WHERE id='doc-a'").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM item_attachments WHERE id='attachment-a'").get().n, 0);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('PASS document replacement: authoritative tenant lookup, DB-failure preservation, new-upload rollback cleanup, shared-file safety and no cross-tenant R2 deletion');
  console.log('PASS overlapping replacements, same-second edits, delete during upload and atomic document/attachment deletion rollback');
} finally { test.close(); }
