import { dev } from '$app/environment';
import { json, type RequestHandler } from '@sveltejs/kit';
import { ensureTenantSchema } from '$lib/server/tenant';

type WhiteboardRow = {
  id: string;
  content: string;
  votes: number;
};
let whiteboardVotesSchemaEnsured = false;

function scopedBusinessId(locals: App.Locals) {
  return String(locals.businessId ?? '').trim();
}

async function hasReviewTable(db: App.Platform['env']['DB']) {
  if (!dev) return true;
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

async function ensureWhiteboardVotesTable(db: App.Platform['env']['DB']) {
  if (!dev) {
    whiteboardVotesSchemaEnsured = true;
    return;
  }

  if (whiteboardVotesSchemaEnsured) return;
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS whiteboard_votes (
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES whiteboard_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      `
    )
    .run();
  whiteboardVotesSchemaEnsured = true;
}

export const GET: RequestHandler = async ({ platform, url, locals }) => {
  const db = platform?.env?.DB;
  if (!db) return json({ error: 'D1 DB binding is missing' }, { status: 503 });
  await ensureTenantSchema(db);
  const businessId = scopedBusinessId(locals);
  if (!businessId) return json({ error: 'Workspace required.' }, { status: 401 });
  const requestedLimit = Number(url.searchParams.get('limit') ?? 100);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(100, Math.floor(requestedLimit)))
    : 100;

  const reviewEnabled = await hasReviewTable(db);
  const result = reviewEnabled
    ? await db
        .prepare(
          `
          SELECT p.id, p.content, p.votes
          FROM whiteboard_posts p
          LEFT JOIN whiteboard_review r ON r.post_id = p.id
          WHERE COALESCE(r.status, 'approved') = 'approved'
            AND p.business_id = ?
          ORDER BY p.votes DESC, p.created_at DESC
          LIMIT ?
        `
        )
        .bind(businessId, limit)
        .all<WhiteboardRow>()
    : await db
        .prepare(
          `
          SELECT id, content, votes
          FROM whiteboard_posts
          WHERE business_id = ?
          ORDER BY votes DESC, created_at DESC
          LIMIT ?
        `
        )
        .bind(businessId, limit)
        .all<WhiteboardRow>();

  return json(result.results ?? [], {
    headers: { 'cache-control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=30' }
  });
};

export const POST: RequestHandler = async ({ platform, request, locals }) => {
  const db = platform?.env?.DB;
  if (!db) return json({ error: 'D1 DB binding is missing' }, { status: 503 });
  await ensureTenantSchema(db);
  const businessId = scopedBusinessId(locals);
  if (!businessId) return json({ error: 'Workspace required.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const action = String(payload.action ?? '');

  if (action === 'upvote') {
    if (!locals.userId) {
      return json({ error: 'Login required to vote.' }, { status: 401 });
    }

    await ensureWhiteboardVotesTable(db);
    await ensureTenantSchema(db, true);

    const id = String(payload.id ?? '');
    if (!id) return json({ error: 'Missing id' }, { status: 400 });

    const existingVote = await db
      .prepare(
        `
        SELECT post_id
        FROM whiteboard_votes
        WHERE post_id = ? AND user_id = ? AND business_id = ?
        LIMIT 1
        `
      )
      .bind(id, locals.userId, businessId)
      .first<{ post_id: string }>();

    if (existingVote) {
      const current = await db
        .prepare(
          `
          SELECT id, content, votes
          FROM whiteboard_posts
          WHERE id = ? AND business_id = ?
          `
        )
        .bind(id, businessId)
        .first<WhiteboardRow>();
      return json({ ...current, alreadyVoted: true }, { status: 409 });
    }

    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `
        INSERT INTO whiteboard_votes (post_id, user_id, created_at, business_id)
        VALUES (?, ?, ?, ?)
        `
      )
      .bind(id, locals.userId, now, businessId)
      .run();

    await db
      .prepare(
        `
        UPDATE whiteboard_posts
        SET votes = votes + 1, updated_at = ?
        WHERE id = ? AND business_id = ?
      `
      )
      .bind(now, id, businessId)
      .run();

    const updated = await db
      .prepare(
        `
        SELECT id, content, votes
        FROM whiteboard_posts
        WHERE id = ? AND business_id = ?
      `
      )
      .bind(id, businessId)
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
        INSERT INTO whiteboard_posts (id, content, votes, created_by, created_at, updated_at, business_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(id, content, locals.userRole === 'admin' ? 1 : 0, locals.userId ?? null, now, now, businessId)
      .run();

    const reviewEnabled = await hasReviewTable(db);
    if (reviewEnabled) {
      const status = locals.userRole === 'admin' ? 'approved' : 'pending';
      await db
        .prepare(
          `
          INSERT OR REPLACE INTO whiteboard_review (post_id, status, reviewed_by, reviewed_at, business_id)
          VALUES (?, ?, ?, ?, ?)
        `
        )
        .bind(id, status, locals.userRole === 'admin' ? locals.userId ?? null : null, now, businessId)
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
