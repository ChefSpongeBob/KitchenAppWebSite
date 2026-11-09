type DB = App.RuntimeEnv['DB'];

export const CHECKLIST_HISTORY_SECONDS = 60 * 86_400;

export function completedChecklistRunStatements(
  db: DB, businessId: string, sectionId: string, actorUserId: string | null | undefined, now: number
) {
  const runId = crypto.randomUUID();
  return [
    db.prepare(`UPDATE checklist_sections SET last_completed_run_id = ?
      WHERE id = ? AND business_id = ? AND last_completed_run_id IS NULL AND changes() = 1
        AND EXISTS (SELECT 1 FROM checklist_items WHERE section_id = ? AND business_id = ?)
        AND NOT EXISTS (SELECT 1 FROM checklist_items WHERE section_id = ? AND business_id = ? AND COALESCE(is_checked, 0) <> 1)`)
      .bind(runId, sectionId, businessId, sectionId, businessId, sectionId, businessId),
    db.prepare(`INSERT INTO checklist_completed_runs
      (id, business_id, section_id, section_title_snapshot, submitted_by_name_snapshot, submitted_at)
      SELECT ?, s.business_id, s.id, s.title, COALESCE(u.display_name, u.email, 'Unknown'), ?
      FROM checklist_sections s LEFT JOIN users u ON u.id = ?
      WHERE s.id = ? AND s.business_id = ? AND s.last_completed_run_id = ?`)
      .bind(runId, now, actorUserId ?? null, sectionId, businessId, runId),
    db.prepare(`INSERT INTO checklist_completed_run_items
      (run_id, business_id, item_id, item_name_snapshot, completed_by_name_snapshot, completed_at)
      SELECT r.id, i.business_id, i.id, i.content, COALESCE(u.display_name, u.email, 'Unknown'), i.completed_at
      FROM checklist_items i JOIN checklist_completed_runs r ON r.id = ? AND r.business_id = i.business_id
      LEFT JOIN users u ON u.id = i.completed_by
      WHERE i.section_id = ? AND i.business_id = ?`)
      .bind(runId, sectionId, businessId)
  ];
}

export async function resetChecklistRun(db: DB, businessId: string, sectionId: string) {
  const now = Math.floor(Date.now() / 1000);
  await db.batch([
    db.prepare(`UPDATE checklist_items SET is_checked = 0, completed_by = NULL, completed_at = NULL, updated_at = ?
      WHERE section_id = ? AND business_id = ?`).bind(now, sectionId, businessId),
    db.prepare(`UPDATE checklist_sections SET last_completed_run_id = NULL WHERE id = ? AND business_id = ?`)
      .bind(sectionId, businessId)
  ]);
}

export async function cleanupChecklistHistory(db: DB, now = Math.floor(Date.now() / 1000)) {
  const cutoff = now - CHECKLIST_HISTORY_SECONDS;
  const result = await db.batch([
    db.prepare(`DELETE FROM checklist_completed_runs WHERE id IN (
      SELECT id FROM checklist_completed_runs WHERE submitted_at < ? ORDER BY submitted_at LIMIT 250
    )`).bind(cutoff),
    db.prepare(`DELETE FROM list_item_activity_events WHERE id IN (
      SELECT id FROM list_item_activity_events WHERE domain = 'checklists' AND occurred_at < ? ORDER BY occurred_at LIMIT 1000
    )`).bind(cutoff)
  ]);
  return { runs: result[0].meta.changes, events: result[1].meta.changes };
}
