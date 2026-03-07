import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type SectionRow = {
  section_id: string;
  domain: 'preplists' | 'inventory';
  slug: string;
  title: string;
  item_id: string | null;
  content: string | null;
  amount: number | null;
  par_count: number | null;
  is_checked: number | null;
  sort_order: number | null;
};

type SectionItem = {
  id: string;
  content: string;
  amount: number;
  par_count: number;
  is_checked: number;
  sort_order: number;
};

type SectionGroup = {
  id: string;
  domain: 'preplists' | 'inventory';
  slug: string;
  title: string;
  items: SectionItem[];
};

type NodeNameRow = {
  sensor_id: number;
  name: string;
};

type WhiteboardAdminRow = {
  id: string;
  content: string;
  votes: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  submitted_name: string | null;
  submitted_email: string | null;
};

type DocumentRow = {
  id: string;
  slug: string;
  title: string;
  section: string;
  category: string;
  content: string | null;
  file_url: string | null;
  is_active: number;
};

function requireAdmin(role: string | undefined | null) {
  if (role !== 'admin') {
    throw redirect(303, '/');
  }
}

async function tableExists(db: App.Platform['env']['DB'], tableName: string) {
  const table = await db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
      `
    )
    .bind(tableName)
    .first<{ name: string }>();
  return Boolean(table);
}

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) {
    return { preplists: [], inventory: [], recipes: [], todos: [], users: [], nodeNames: [], whiteboardIdeas: [] };
  }

  const sectionRows = await db
    .prepare(
      `
      SELECT
        s.id AS section_id,
        s.domain,
        s.slug,
        s.title,
        i.id AS item_id,
        i.content,
        i.amount,
        i.par_count,
        i.is_checked,
        i.sort_order
      FROM list_sections s
      LEFT JOIN list_items i ON i.section_id = s.id
      WHERE s.domain IN ('preplists', 'inventory')
      ORDER BY s.domain ASC, s.slug ASC, i.sort_order ASC, i.created_at ASC
      `
    )
    .all<SectionRow>();

  const grouped = new Map<string, SectionGroup>();
  for (const row of sectionRows.results ?? []) {
    const key = row.section_id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: row.section_id,
        domain: row.domain,
        slug: row.slug,
        title: row.title,
        items: []
      });
    }

    if (row.item_id) {
      grouped.get(key)?.items.push({
        id: row.item_id,
        content: row.content ?? '',
        amount: row.amount ?? 0,
        par_count: row.par_count ?? 0,
        is_checked: row.is_checked ?? 0,
        sort_order: row.sort_order ?? 0
      });
    }
  }

  const sections = Array.from(grouped.values());
  const preplists = sections.filter((s) => s.domain === 'preplists');
  const inventory = sections.filter((s) => s.domain === 'inventory');

  const recipes = await db
    .prepare(
      `
      SELECT id, title, category, ingredients, instructions, created_at
      FROM recipes
      ORDER BY created_at DESC
      `
    )
    .all();

  const todos = await db
    .prepare(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.completed_at,
        t.created_at,
        ta.user_id AS assigned_to,
        u.display_name AS assigned_name,
        u.email AS assigned_email
      FROM todos t
      LEFT JOIN todo_assignments ta ON ta.todo_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      ORDER BY t.created_at DESC
      `
    )
    .all();

  const users = await db
    .prepare(
      `
      SELECT id, display_name, email, COALESCE(role, 'user') AS role
      FROM users
      WHERE is_active = 1
      ORDER BY COALESCE(display_name, email) ASC
      `
    )
    .all();

  const nodeNamesTableExists = await tableExists(db, 'sensor_nodes');
  let nodeNames: NodeNameRow[] = [];
  if (nodeNamesTableExists) {
    const nodeResult = await db
      .prepare(
        `
        SELECT sensor_id, name
        FROM sensor_nodes
        ORDER BY sensor_id ASC
        `
      )
      .all<NodeNameRow>();
    nodeNames = nodeResult.results ?? [];
  }

  const whiteboardReviewExists = await tableExists(db, 'whiteboard_review');
  const whiteboardIdeas = whiteboardReviewExists
    ? await db
        .prepare(
          `
          SELECT
            p.id,
            p.content,
            p.votes,
            COALESCE(r.status, 'approved') AS status,
            p.created_at,
            u.display_name AS submitted_name,
            u.email AS submitted_email
          FROM whiteboard_posts p
          LEFT JOIN whiteboard_review r ON r.post_id = p.id
          LEFT JOIN users u ON u.id = p.created_by
          ORDER BY
            CASE COALESCE(r.status, 'approved')
              WHEN 'pending' THEN 0
              WHEN 'approved' THEN 1
              ELSE 2
            END ASC,
            p.votes DESC,
            p.created_at DESC
          `
        )
        .all<WhiteboardAdminRow>()
    : await db
        .prepare(
          `
          SELECT
            p.id,
            p.content,
            p.votes,
            'approved' AS status,
            p.created_at,
            u.display_name AS submitted_name,
            u.email AS submitted_email
          FROM whiteboard_posts p
          LEFT JOIN users u ON u.id = p.created_by
          ORDER BY p.votes DESC, p.created_at DESC
          `
        )
        .all<WhiteboardAdminRow>();

  const documents = await db
    .prepare(
      `
      SELECT id, slug, title, section, category, content, file_url, is_active
      FROM documents
      ORDER BY updated_at DESC, title ASC
      `
    )
    .all<DocumentRow>();

  return {
    preplists,
    inventory,
    recipes: recipes.results ?? [],
    todos: todos.results ?? [],
    users: users.results ?? [],
    nodeNames,
    whiteboardIdeas: whiteboardIdeas.results ?? [],
    documents: documents.results ?? []
  };
};

export const actions: Actions = {
  add_list_item: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const sectionId = String(formData.get('section_id') ?? '');
    const content = String(formData.get('content') ?? '').trim();
    const parCount = Number(formData.get('par_count') ?? 0);
    if (!sectionId || !content || !Number.isFinite(parCount) || parCount < 0) {
      return fail(400, { error: 'Invalid list item input.' });
    }

    const now = Math.floor(Date.now() / 1000);
    const maxSort = await db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM list_items WHERE section_id = ?`)
      .bind(sectionId)
      .first<{ max_sort: number }>();

    await db
      .prepare(
        `
        INSERT INTO list_items (
          id, section_id, content, sort_order, is_checked,
          amount, par_count, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), sectionId, content, (maxSort?.max_sort ?? -1) + 1, parCount, now, now)
      .run();

    return { success: true };
  },

  update_list_item: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    const content = String(formData.get('content') ?? '').trim();
    const parCount = Number(formData.get('par_count') ?? 0);
    if (!id || !content || !Number.isFinite(parCount) || parCount < 0) {
      return fail(400, { error: 'Invalid update input.' });
    }

    await db
      .prepare(`UPDATE list_items SET content = ?, par_count = ?, updated_at = ? WHERE id = ?`)
      .bind(content, parCount, Math.floor(Date.now() / 1000), id)
      .run();

    return { success: true };
  },

  delete_list_item: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing list item id.' });

    await db.prepare(`DELETE FROM list_items WHERE id = ?`).bind(id).run();
    return { success: true };
  },

  create_recipe: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const f = await request.formData();
    const title = String(f.get('title') ?? '').trim();
    const category = String(f.get('category') ?? '').trim();
    const ingredients = String(f.get('ingredients') ?? '').trim();
    const instructions = String(f.get('instructions') ?? '').trim();
    if (!title || !category || !ingredients || !instructions) {
      return fail(400, { error: 'All recipe fields are required.' });
    }

    await db
      .prepare(
        `
        INSERT INTO recipes (title, category, ingredients, instructions, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        `
      )
      .bind(title, category, ingredients, instructions)
      .run();

    return { success: true };
  },

  delete_recipe: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const f = await request.formData();
    const id = Number(f.get('id'));
    if (!Number.isFinite(id)) return fail(400, { error: 'Invalid recipe id.' });

    await db.prepare(`DELETE FROM recipes WHERE id = ?`).bind(id).run();
    return { success: true };
  },

  create_todo: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const assignedTo = String(formData.get('assigned_to') ?? '').trim();
    if (!title) return fail(400, { error: 'Todo title is required.' });

    const now = Math.floor(Date.now() / 1000);
    const todoId = crypto.randomUUID();
    await db
      .prepare(
        `
        INSERT INTO todos (
          id, title, description, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .bind(todoId, title, description, locals.userId, now, now)
      .run();

    if (assignedTo) {
      await db
        .prepare(
          `
          INSERT OR REPLACE INTO todo_assignments (todo_id, user_id, assigned_at)
          VALUES (?, ?, ?)
          `
        )
        .bind(todoId, assignedTo, now)
        .run();
    }

    return { success: true };
  },

  delete_todo: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing todo id.' });

    await db.prepare(`DELETE FROM todo_assignments WHERE todo_id = ?`).bind(id).run();
    await db.prepare(`DELETE FROM todo_completion_log WHERE todo_id = ?`).bind(id).run();
    await db.prepare(`DELETE FROM todos WHERE id = ?`).bind(id).run();
    return { success: true };
  },

  add_node_name: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    if (!(await tableExists(db, 'sensor_nodes'))) {
      return fail(400, { error: 'sensor_nodes table missing. Run db:migrate:nodenames first.' });
    }

    const formData = await request.formData();
    const sensorId = Number(formData.get('sensor_id'));
    const name = String(formData.get('name') ?? '').trim();
    if (!Number.isFinite(sensorId) || sensorId <= 0 || !name) {
      return fail(400, { error: 'Invalid node name input.' });
    }

    await db
      .prepare(
        `
        INSERT OR REPLACE INTO sensor_nodes (sensor_id, name, updated_at)
        VALUES (?, ?, ?)
        `
      )
      .bind(sensorId, name, Math.floor(Date.now() / 1000))
      .run();

    return { success: true };
  },

  delete_node_name: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    if (!(await tableExists(db, 'sensor_nodes'))) {
      return fail(400, { error: 'sensor_nodes table missing. Run db:migrate:nodenames first.' });
    }

    const formData = await request.formData();
    const sensorId = Number(formData.get('sensor_id'));
    if (!Number.isFinite(sensorId) || sensorId <= 0) {
      return fail(400, { error: 'Invalid sensor id.' });
    }

    await db
      .prepare(`DELETE FROM sensor_nodes WHERE sensor_id = ?`)
      .bind(sensorId)
      .run();

    return { success: true };
  },

  approve_whiteboard: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    if (!(await tableExists(db, 'whiteboard_review'))) {
      return fail(400, { error: 'whiteboard_review table missing. Run db:migrate:whiteboardmod first.' });
    }

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing whiteboard id.' });

    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `
        INSERT OR REPLACE INTO whiteboard_review (post_id, status, reviewed_by, reviewed_at)
        VALUES (?, 'approved', ?, ?)
        `
      )
      .bind(id, locals.userId ?? null, now)
      .run();

    return { success: true };
  },

  reject_whiteboard: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    if (!(await tableExists(db, 'whiteboard_review'))) {
      return fail(400, { error: 'whiteboard_review table missing. Run db:migrate:whiteboardmod first.' });
    }

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing whiteboard id.' });

    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `
        INSERT OR REPLACE INTO whiteboard_review (post_id, status, reviewed_by, reviewed_at)
        VALUES (?, 'rejected', ?, ?)
        `
      )
      .bind(id, locals.userId ?? null, now)
      .run();

    return { success: true };
  },

  delete_whiteboard: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '');
    if (!id) return fail(400, { error: 'Missing whiteboard id.' });

    await db.prepare(`DELETE FROM whiteboard_review WHERE post_id = ?`).bind(id).run();
    await db.prepare(`DELETE FROM whiteboard_posts WHERE id = ?`).bind(id).run();

    return { success: true };
  },

  create_document: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
    const title = String(formData.get('title') ?? '').trim();
    const section = String(formData.get('section') ?? 'Docs').trim();
    const category = String(formData.get('category') ?? 'General').trim();
    const content = String(formData.get('content') ?? '').trim();
    const fileUrl = String(formData.get('file_url') ?? '').trim();

    if (!slug || !title) return fail(400, { error: 'Slug and title are required.' });
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `
        INSERT INTO documents (
          id, slug, title, section, category, content, file_url, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `
      )
      .bind(crypto.randomUUID(), slug, title, section, category, content || null, fileUrl || null, now, now)
      .run();

    return { success: true };
  },

  update_document: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
    const title = String(formData.get('title') ?? '').trim();
    const section = String(formData.get('section') ?? 'Docs').trim();
    const category = String(formData.get('category') ?? 'General').trim();
    const content = String(formData.get('content') ?? '').trim();
    const fileUrl = String(formData.get('file_url') ?? '').trim();
    const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;

    if (!id || !slug || !title) return fail(400, { error: 'Document id, slug, and title are required.' });

    await db
      .prepare(
        `
        UPDATE documents
        SET slug = ?, title = ?, section = ?, category = ?, content = ?, file_url = ?, is_active = ?, updated_at = ?
        WHERE id = ?
        `
      )
      .bind(slug, title, section, category, content || null, fileUrl || null, isActive, Math.floor(Date.now() / 1000), id)
      .run();

    return { success: true };
  },

  delete_document: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing document id.' });

    await db.prepare(`DELETE FROM documents WHERE id = ?`).bind(id).run();

    return { success: true };
  },

  make_user_admin: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    const formData = await request.formData();
    const userId = String(formData.get('user_id') ?? '').trim();
    if (!userId) return fail(400, { error: 'Missing user id.' });

    const target = await db
      .prepare(`SELECT id, COALESCE(role, 'user') AS role FROM users WHERE id = ? LIMIT 1`)
      .bind(userId)
      .first<{ id: string; role: string }>();

    if (!target) return fail(404, { error: 'User not found.' });
    if (target.role === 'admin') return { success: true };

    await db
      .prepare(`UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?`)
      .bind(Math.floor(Date.now() / 1000), userId)
      .run();

    return { success: true };
  }
};
