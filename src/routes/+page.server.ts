import type { PageServerLoad } from './$types';

type HomeTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  assigned_email: string | null;
};

type IdeaRow = {
  id: string;
  content: string;
  votes: number;
};

type TempRow = {
  sensor_id: number;
  temperature: number;
  ts: number;
};

type NodeNameRow = {
  sensor_id: number;
  name: string;
};

async function tableExists(db: App.Platform['env']['DB'], tableName: string) {
  const row = await db
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
  return Boolean(row);
}

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) {
    return {
      userName: 'Team',
      todayTasks: [],
      todayMeta: { assignedCount: 0, unassignedCount: 0 },
      topIdeas: [],
      nodeTemps: [],
      tempSeries: { avg: [] },
      kpis: { openTasks: 0, completedToday: 0, avgTemp: null, pendingIdeas: 0 },
      refreshedAt: Math.floor(Date.now() / 1000)
    };
  }

  let userName = 'Team';
  if (locals.userId) {
    const user = await db
      .prepare(`SELECT display_name, email FROM users WHERE id = ? LIMIT 1`)
      .bind(locals.userId)
      .first<{ display_name: string | null; email: string | null }>();
    userName = user?.display_name || user?.email || 'Team';
  }

  let todayTasks: HomeTask[] = [];
  if (locals.userId) {
    const taskResult = await db
      .prepare(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          ta.user_id AS assigned_to,
          au.display_name AS assigned_name,
          au.email AS assigned_email
        FROM todos t
        LEFT JOIN todo_assignments ta ON ta.todo_id = t.id
        LEFT JOIN users au ON au.id = ta.user_id
        WHERE t.completed_at IS NULL
          AND (ta.user_id = ? OR ta.user_id IS NULL)
        ORDER BY CASE WHEN ta.user_id = ? THEN 0 ELSE 1 END ASC, t.created_at DESC
        LIMIT 6
        `
      )
      .bind(locals.userId, locals.userId)
      .all<HomeTask>();
    todayTasks = taskResult.results ?? [];
  }

  const assignedCount = todayTasks.filter((task) => task.assigned_to === locals.userId).length;
  const unassignedCount = todayTasks.filter((task) => task.assigned_to === null).length;

  const reviewEnabled = await tableExists(db, 'whiteboard_review');
  const topIdeasResult = reviewEnabled
    ? await db
        .prepare(
          `
          SELECT p.id, p.content, p.votes
          FROM whiteboard_posts p
          LEFT JOIN whiteboard_review r ON r.post_id = p.id
          WHERE COALESCE(r.status, 'approved') = 'approved'
          ORDER BY p.votes DESC, p.created_at DESC
          LIMIT 3
          `
        )
        .all<IdeaRow>()
    : await db
        .prepare(
          `
          SELECT id, content, votes
          FROM whiteboard_posts
          ORDER BY votes DESC, created_at DESC
          LIMIT 3
          `
        )
        .all<IdeaRow>();

  const tempsResult = await db
    .prepare(
      `
      SELECT sensor_id, temperature, ts
      FROM temps
      ORDER BY ts DESC
      LIMIT 1500
      `
    )
    .all<TempRow>();

  const rows = tempsResult.results ?? [];
  const latestBySensor = new Map<number, TempRow>();
  for (const row of rows) {
    if (!latestBySensor.has(row.sensor_id)) {
      latestBySensor.set(row.sensor_id, row);
      if (latestBySensor.size >= 3) break;
    }
  }
  const nodeTemps = Array.from(latestBySensor.values()).sort((a, b) => a.sensor_id - b.sensor_id);

  const nodeTable = await tableExists(db, 'sensor_nodes');
  const namesBySensor = new Map<number, string>();
  if (nodeTable) {
    const nameRows = await db
      .prepare(`SELECT sensor_id, name FROM sensor_nodes`)
      .all<NodeNameRow>();
    for (const row of nameRows.results ?? []) {
      namesBySensor.set(row.sensor_id, row.name);
    }
  }

  const bucketAverages = new Map<number, { sum: number; count: number }>();
  for (const row of rows) {
    const bucket = Math.floor(row.ts / 300) * 300;
    const current = bucketAverages.get(bucket) ?? { sum: 0, count: 0 };
    current.sum += row.temperature;
    current.count += 1;
    bucketAverages.set(bucket, current);
  }
  const avg = Array.from(bucketAverages.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-24)
    .map(([, value]) => Number((value.sum / value.count).toFixed(2)));

  const openTasksRow = await db
    .prepare(`SELECT COUNT(*) AS count FROM todos WHERE completed_at IS NULL`)
    .first<{ count: number }>();

  const dayStart = Math.floor(new Date(new Date().toDateString()).getTime() / 1000);
  const completedTodayRow = locals.userId
    ? await db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM todo_completion_log
          WHERE completed_by = ? AND completed_at >= ?
          `
        )
        .bind(locals.userId, dayStart)
        .first<{ count: number }>()
    : { count: 0 };

  const pendingIdeasRow = reviewEnabled
    ? await db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM whiteboard_review
          WHERE status = 'pending'
          `
        )
        .first<{ count: number }>()
    : { count: 0 };

  return {
    userName,
    todayTasks,
    todayMeta: { assignedCount, unassignedCount },
    topIdeas: (topIdeasResult.results ?? []).map((r) => ({ text: r.content, votes: r.votes })),
    nodeTemps: nodeTemps.map((r) => ({
      sensorId: r.sensor_id,
      nodeName: namesBySensor.get(r.sensor_id) ?? null,
      temperature: r.temperature,
      ts: r.ts
    })),
    tempSeries: { avg },
    kpis: {
      openTasks: openTasksRow?.count ?? 0,
      completedToday: completedTodayRow?.count ?? 0,
      avgTemp: avg.length ? Number((avg.reduce((sum, value) => sum + value, 0) / avg.length).toFixed(1)) : null,
      pendingIdeas: pendingIdeasRow?.count ?? 0
    },
    refreshedAt: Math.floor(Date.now() / 1000)
  };
};
