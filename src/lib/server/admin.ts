import { fail, redirect } from '@sveltejs/kit';
import { ensureAnnouncementsSchema, loadHomepageAnnouncement } from '$lib/server/announcements';
import { ensureDailySpecialsSchema } from '$lib/server/dailySpecials';
import { isValidRecipeCategory, normalizeRecipeCategory } from '$lib/assets/recipeCategories';

type D1 = App.Platform['env']['DB'];

export type AdminSectionRow = {
  section_id: string;
  domain: 'preplists' | 'inventory' | 'orders';
  slug: string;
  title: string;
  item_id: string | null;
  content: string | null;
  amount: number | null;
  par_count: number | null;
  is_checked: number | null;
  sort_order: number | null;
};

export type AdminSectionItem = {
  id: string;
  content: string;
  amount: number;
  par_count: number;
  is_checked: number;
  sort_order: number;
};

export type AdminSectionGroup = {
  id: string;
  domain: 'preplists' | 'inventory' | 'orders';
  slug: string;
  title: string;
  items: AdminSectionItem[];
};

export type AdminNodeName = {
  sensor_id: number;
  name: string;
};

export type AdminWhiteboardIdea = {
  id: string;
  content: string;
  votes: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  submitted_name: string | null;
  submitted_email: string | null;
};

export type AdminDocument = {
  id: string;
  slug: string;
  title: string;
  section: string;
  category: string;
  content: string | null;
  file_url: string | null;
  is_active: number;
};

export type AdminTodo = {
  id: string;
  title: string;
  description: string;
  completed_at: number | null;
  created_at: number;
  assigned_to: string | null;
  assigned_name: string | null;
  assigned_email: string | null;
};

export type AdminUser = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
  is_active: number;
  can_manage_specials: number;
};

export function requireAdmin(role: string | undefined | null) {
  if (role !== 'admin') {
    throw redirect(303, '/');
  }
}

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export async function tableExists(db: D1, tableName: string) {
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

export async function usersHasIsActiveColumn(db: D1) {
  const columns = await db.prepare(`PRAGMA table_info(users)`).all<{ name: string }>();
  return (columns.results ?? []).some((column) => column.name === 'is_active');
}

export async function loadAdminSections(db: D1) {
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
      WHERE s.domain IN ('preplists', 'inventory', 'orders')
      ORDER BY s.domain ASC, s.slug ASC, i.sort_order ASC, i.created_at ASC
      `
    )
    .all<AdminSectionRow>();

  const grouped = new Map<string, AdminSectionGroup>();
  for (const row of sectionRows.results ?? []) {
    if (!grouped.has(row.section_id)) {
      grouped.set(row.section_id, {
        id: row.section_id,
        domain: row.domain,
        slug: row.slug,
        title: row.title,
        items: []
      });
    }

    if (row.item_id) {
      grouped.get(row.section_id)?.items.push({
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
  return {
    preplists: sections.filter((section) => section.domain === 'preplists'),
    inventory: sections.filter((section) => section.domain === 'inventory'),
    orders: sections.filter((section) => section.domain === 'orders')
  };
}

export async function loadAdminRecipes(db: D1) {
  const recipes = await db
    .prepare(
      `
      SELECT id, title, category, ingredients, instructions, created_at
      FROM recipes
      ORDER BY created_at DESC
      `
    )
    .all();
  return recipes.results ?? [];
}

export async function loadAdminTodos(db: D1) {
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
    .all<AdminTodo>();
  return todos.results ?? [];
}

export async function loadAdminUsers(db: D1) {
  await ensureDailySpecialsSchema(db);

  const hasIsActive = await usersHasIsActiveColumn(db);
  const users = hasIsActive
    ? await db
        .prepare(
          `
          SELECT
            u.id,
            u.display_name,
            u.email,
            COALESCE(u.role, 'user') AS role,
            COALESCE(u.is_active, 1) AS is_active,
            CASE WHEN dse.user_id IS NULL THEN 0 ELSE 1 END AS can_manage_specials
          FROM users u
          LEFT JOIN daily_specials_editors dse ON dse.user_id = u.id
          ORDER BY COALESCE(u.display_name, u.email) ASC
          `
        )
        .all<AdminUser>()
    : await db
        .prepare(
          `
          SELECT
            u.id,
            u.display_name,
            u.email,
            COALESCE(u.role, 'user') AS role,
            1 AS is_active,
            CASE WHEN dse.user_id IS NULL THEN 0 ELSE 1 END AS can_manage_specials
          FROM users u
          LEFT JOIN daily_specials_editors dse ON dse.user_id = u.id
          ORDER BY COALESCE(u.display_name, u.email) ASC
          `
        )
        .all<AdminUser>();

  return users.results ?? [];
}

export async function loadAdminNodeNames(db: D1) {
  if (!(await tableExists(db, 'sensor_nodes'))) return [];
  const nodeResult = await db
    .prepare(
      `
      SELECT sensor_id, name
      FROM sensor_nodes
      ORDER BY sensor_id ASC
      `
    )
    .all<AdminNodeName>();
  return nodeResult.results ?? [];
}

export async function loadAdminWhiteboardIdeas(db: D1) {
  const whiteboardReviewExists = await tableExists(db, 'whiteboard_review');
  const ideas = whiteboardReviewExists
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
        .all<AdminWhiteboardIdea>()
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
        .all<AdminWhiteboardIdea>();

  return ideas.results ?? [];
}

export async function loadAdminDocuments(db: D1) {
  const documents = await db
    .prepare(
      `
      SELECT id, slug, title, section, category, content, file_url, is_active
      FROM documents
      ORDER BY updated_at DESC, title ASC
      `
    )
    .all<AdminDocument>();
  return documents.results ?? [];
}

export async function loadAdminAnnouncement(db: D1) {
  await ensureAnnouncementsSchema(db);
  return loadHomepageAnnouncement(db);
}

export async function addListItem(request: Request, locals: App.Locals) {
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
}

export async function updateListItem(request: Request, locals: App.Locals) {
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
}

export async function deleteListItem(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail(400, { error: 'Missing list item id.' });

  await db.prepare(`DELETE FROM list_items WHERE id = ?`).bind(id).run();
  return { success: true };
}

export async function createRecipe(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const f = await request.formData();
  const title = String(f.get('title') ?? '').trim();
  const category = normalizeRecipeCategory(String(f.get('category') ?? ''));
  const ingredients = String(f.get('ingredients') ?? '').trim();
  const materialsNeeded = String(f.get('materials_needed') ?? f.get('procedure') ?? '').trim();
  const instruction = String(f.get('instruction') ?? '').trim();
  const fallbackInstructions = String(f.get('instructions') ?? '').trim();

  const instructions = materialsNeeded && instruction
    ? `Materials needed:\n${materialsNeeded}\n\nInstruction:\n${instruction}`
    : fallbackInstructions;

  if (!title || !category || !ingredients || !instructions) {
    return fail(400, { error: 'All recipe fields are required.' });
  }
  if (!isValidRecipeCategory(category)) {
    return fail(400, { error: 'Invalid recipe category selected.' });
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
}

export async function deleteRecipe(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const f = await request.formData();
  const id = Number(f.get('id'));
  if (!Number.isFinite(id)) return fail(400, { error: 'Invalid recipe id.' });

  await db.prepare(`DELETE FROM recipes WHERE id = ?`).bind(id).run();
  return { success: true };
}

export async function createTodo(request: Request, locals: App.Locals) {
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
}

export async function deleteTodo(request: Request, locals: App.Locals) {
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
}

export async function addNodeName(request: Request, locals: App.Locals) {
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
}

export async function deleteNodeName(request: Request, locals: App.Locals) {
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

  await db.prepare(`DELETE FROM sensor_nodes WHERE sensor_id = ?`).bind(sensorId).run();
  return { success: true };
}

export async function approveWhiteboard(request: Request, locals: App.Locals) {
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
}

export async function rejectWhiteboard(request: Request, locals: App.Locals) {
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
}

export async function deleteWhiteboard(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  if (!id) return fail(400, { error: 'Missing whiteboard id.' });

  await db.prepare(`DELETE FROM whiteboard_review WHERE post_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM whiteboard_posts WHERE id = ?`).bind(id).run();

  return { success: true };
}

export async function createDocument(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const formData = await request.formData();
  const rawSlug = String(formData.get('slug') ?? '');
  const customSlug = String(formData.get('slug_custom') ?? '');
  const slug = normalizeSlug(rawSlug === 'custom' ? customSlug : rawSlug);
  const title = String(formData.get('title') ?? '').trim();
  const section = String(formData.get('section') ?? 'Docs').trim();
  const category = String(formData.get('category') ?? 'General').trim();
  const content = String(formData.get('content') ?? '').trim();
  const fileUrl = String(formData.get('file_url') ?? '').trim();
  const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;

  if (!slug || !title) return fail(400, { error: 'Slug and title are required.' });
  if (!/^[a-z0-9-]+$/.test(slug)) return fail(400, { error: 'Slug can only use letters, numbers, and hyphens.' });
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO documents (
        id, slug, title, section, category, content, file_url, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), slug, title, section, category, content || null, fileUrl || null, isActive, now, now)
    .run();

  return { success: true };
}

export async function updateDocument(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  const rawSlug = String(formData.get('slug') ?? '');
  const customSlug = String(formData.get('slug_custom') ?? '');
  const slug = normalizeSlug(rawSlug === 'custom' ? customSlug : rawSlug);
  const title = String(formData.get('title') ?? '').trim();
  const section = String(formData.get('section') ?? 'Docs').trim();
  const category = String(formData.get('category') ?? 'General').trim();
  const content = String(formData.get('content') ?? '').trim();
  const fileUrl = String(formData.get('file_url') ?? '').trim();
  const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;

  if (!id || !slug || !title) return fail(400, { error: 'Document id, slug, and title are required.' });
  if (!/^[a-z0-9-]+$/.test(slug)) return fail(400, { error: 'Slug can only use letters, numbers, and hyphens.' });

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
}

export async function deleteDocument(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const formData = await request.formData();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return fail(400, { error: 'Missing document id.' });

  await db.prepare(`DELETE FROM documents WHERE id = ?`).bind(id).run();
  return { success: true };
}

export async function saveAnnouncement(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  await ensureAnnouncementsSchema(db);

  const formData = await request.formData();
  const content = String(formData.get('content') ?? '').trim();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO announcements (id, content, updated_by, updated_at)
      VALUES ('homepage', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
      `
    )
    .bind(content, locals.userId ?? null, now)
    .run();

  return { success: true };
}

export async function makeUserAdmin(request: Request, locals: App.Locals) {
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

export async function approveUser(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });
  if (!(await usersHasIsActiveColumn(db))) {
    return fail(400, { error: 'users.is_active column missing. Run auth migration first.' });
  }

  await db
    .prepare(`UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?`)
    .bind(Math.floor(Date.now() / 1000), userId)
    .run();

  return { success: true };
}

export async function toggleSpecialsAccess(request: Request, locals: App.Locals) {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return fail(503, { error: 'Database not configured.' });

  await ensureDailySpecialsSchema(db);

  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) return fail(400, { error: 'Missing user id.' });

  const existing = await db
    .prepare(`SELECT user_id FROM daily_specials_editors WHERE user_id = ? LIMIT 1`)
    .bind(userId)
    .first<{ user_id: string }>();

  if (existing) {
    await db.prepare(`DELETE FROM daily_specials_editors WHERE user_id = ?`).bind(userId).run();
    return { success: true };
  }

  await db
    .prepare(
      `
      INSERT INTO daily_specials_editors (user_id, granted_by, updated_at)
      VALUES (?, ?, ?)
      `
    )
    .bind(userId, locals.userId ?? null, Math.floor(Date.now() / 1000))
    .run();

  return { success: true };
}
