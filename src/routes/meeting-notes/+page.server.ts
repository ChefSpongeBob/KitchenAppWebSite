import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type MeetingNoteRow = {
  id: string;
  content: string;
  author_id: string;
  created_at: number;
  updated_at: number;
  author_name: string | null;
  author_email: string | null;
};
let meetingNotesSchemaEnsured = false;

function requireAdmin(role: string | undefined | null) {
  if (role !== 'admin') {
    throw redirect(303, '/');
  }
}

async function ensureMeetingNotesTable(db: App.Platform['env']['DB']) {
  if (meetingNotesSchemaEnsured) return;
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS meeting_notes (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_meeting_notes_updated_at
      ON meeting_notes(updated_at DESC)
      `
    )
    .run();
  meetingNotesSchemaEnsured = true;
}

async function getNoteForAuthor(
  db: App.Platform['env']['DB'],
  noteId: string,
  authorId: string
) {
  return db
    .prepare(
      `
      SELECT id, author_id
      FROM meeting_notes
      WHERE id = ? AND author_id = ?
      LIMIT 1
      `
    )
    .bind(noteId, authorId)
    .first<{ id: string; author_id: string }>();
}

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) {
    return { notes: [] };
  }

  await ensureMeetingNotesTable(db);

  const result = await db
    .prepare(
      `
      SELECT
        n.id,
        n.content,
        n.author_id,
        n.created_at,
        n.updated_at,
        u.display_name AS author_name,
        u.email AS author_email
      FROM meeting_notes n
      LEFT JOIN users u ON u.id = n.author_id
      ORDER BY n.updated_at DESC, n.created_at DESC
      `
    )
    .all<MeetingNoteRow>();

  return {
    notes: (result.results ?? []).map((note) => ({
      id: note.id,
      content: note.content,
      authorId: note.author_id,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      authorName: note.author_name,
      authorEmail: note.author_email,
      canEdit: note.author_id === locals.userId
    }))
  };
};

export const actions: Actions = {
  create_note: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db || !locals.userId) {
      throw redirect(303, '/login');
    }

    await ensureMeetingNotesTable(db);

    const formData = await request.formData();
    const content = String(formData.get('content') ?? '').trim();
    if (!content) {
      return fail(400, { createError: 'Note content is required.' });
    }

    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `
        INSERT INTO meeting_notes (id, author_id, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), locals.userId, content, now, now)
      .run();

    return { createSuccess: true };
  },

  update_note: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db || !locals.userId) {
      throw redirect(303, '/login');
    }

    await ensureMeetingNotesTable(db);

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    const content = String(formData.get('content') ?? '').trim();
    if (!id || !content) {
      return fail(400, { updateError: 'A note id and content are required.' });
    }

    const note = await getNoteForAuthor(db, id, locals.userId);
    if (!note) {
      return fail(403, { updateError: 'You can only edit your own meeting notes.' });
    }

    await db
      .prepare(
        `
        UPDATE meeting_notes
        SET content = ?, updated_at = ?
        WHERE id = ?
        `
      )
      .bind(content, Math.floor(Date.now() / 1000), id)
      .run();

    return { updateSuccess: true };
  },

  delete_note: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db || !locals.userId) {
      throw redirect(303, '/login');
    }

    await ensureMeetingNotesTable(db);

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    if (!id) {
      return fail(400, { deleteError: 'A note id is required.' });
    }

    const note = await getNoteForAuthor(db, id, locals.userId);
    if (!note) {
      return fail(403, { deleteError: 'You can only delete your own meeting notes.' });
    }

    await db.prepare(`DELETE FROM meeting_notes WHERE id = ?`).bind(id).run();
    return { deleteSuccess: true };
  }
};
