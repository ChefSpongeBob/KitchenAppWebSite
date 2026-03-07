import { json, type RequestHandler } from '@sveltejs/kit';

type WhiteboardRow = {
  id: string;
  content: string;
  votes: number;
};

async function hasReviewTable(db: App.Platform['env']['DB']) {
  const table = await db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'whiteboard_review'
      LIMIT 1
      `
    )
    .first<{ name: string }>();
  return Boolean(table);
}

export const GET: RequestHandler = async ({ platform }) => {
  const db = platform?.env?.DB;
  if (!db) return json({ error: 'D1 DB binding is missing' }, { status: 503 });

  const reviewEnabled = await hasReviewTable(db);
  const result = reviewEnabled
    ? await db
        .prepare(
          `
          SELECT p.id, p.content, p.votes
          FROM whiteboard_posts p
          LEFT JOIN whiteboard_review r ON r.post_id = p.id
          WHERE COALESCE(r.status, 'approved') = 'approved'
          ORDER BY p.votes DESC, p.created_at DESC
          LIMIT 100
        `
        )
        .all<WhiteboardRow>()
    : await db
        .prepare(
          `
          SELECT id, content, votes
          FROM whiteboard_posts
          ORDER BY votes DESC, created_at DESC
          LIMIT 100
        `
        )
        .all<WhiteboardRow>();

  return json(result.results ?? []);
};

export const POST: RequestHandler = async ({ platform, request, locals }) => {
  const db = platform?.env?.DB;
  if (!db) return json({ error: 'D1 DB binding is missing' }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const action = String(payload.action ?? '');

  if (action === 'upvote') {
    const id = String(payload.id ?? '');
    if (!id) return json({ error: 'Missing id' }, { status: 400 });

    await db
      .prepare(
        `
        UPDATE whiteboard_posts
        SET votes = votes + 1, updated_at = ?
        WHERE id = ?
      `
      )
      .bind(Math.floor(Date.now() / 1000), id)
      .run();

    const updated = await db
      .prepare(
        `
        SELECT id, content, votes
        FROM whiteboard_posts
        WHERE id = ?
      `
      )
      .bind(id)
      .first<WhiteboardRow>();

    return json(updated ?? null);
  }

  if (action === 'add') {
    const content = String(payload.content ?? '').trim();
    if (!content) return json({ error: 'Missing content' }, { status: 400 });

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    await db
      .prepare(
        `
        INSERT INTO whiteboard_posts (id, content, votes, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .bind(id, content, locals.userRole === 'admin' ? 1 : 0, locals.userId ?? null, now, now)
      .run();

    const reviewEnabled = await hasReviewTable(db);
    if (reviewEnabled) {
      const status = locals.userRole === 'admin' ? 'approved' : 'pending';
      await db
        .prepare(
          `
          INSERT OR REPLACE INTO whiteboard_review (post_id, status, reviewed_by, reviewed_at)
          VALUES (?, ?, ?, ?)
        `
        )
        .bind(id, status, locals.userRole === 'admin' ? locals.userId ?? null : null, now)
        .run();
    }

    return json({
      id,
      content,
      votes: locals.userRole === 'admin' ? 1 : 0,
      status: locals.userRole === 'admin' ? 'approved' : 'pending'
    });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};
