import type { PageServerLoad } from './$types';
import { loadHomepageAnnouncement } from '$lib/server/announcements';
import { hasTable } from '$lib/server/dbSchema';
import { loadDailySpecials } from '$lib/server/dailySpecials';
import { loadEmployeeSpotlight } from '$lib/server/employeeSpotlight';
import { loadTodayShifts } from '$lib/server/schedules';

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

type TodayShift = {
  id: string;
  department: string;
  role: string;
  detail: string;
  startTime: string;
  endLabel: string;
  notes: string;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  const isAdmin = locals.userRole === 'admin';
  const HOMEPAGE_TEMP_LIMIT = 480;
  if (!db) {
    return {
      isAdmin,
      userName: 'Team',
      announcement: { content: '', updatedAt: 0 },
      employeeSpotlight: { employeeName: '', shoutout: '', updatedAt: 0 },
      dailySpecials: [],
      todayTasks: [],
      todaySchedule: [],
      todayMeta: { assignedCount: 0, unassignedCount: 0 },
      topIdeas: [],
      nodeTemps: [],
      tempSeries: { avg: [] },
      refreshedAt: Math.floor(Date.now() / 1000)
    };
  }

  const reviewEnabledPromise = hasTable(db, 'whiteboard_review');
  const nodeTablePromise = hasTable(db, 'sensor_nodes');
  const announcementPromise = loadHomepageAnnouncement(db);
  const employeeSpotlightPromise = loadEmployeeSpotlight(db);
  const dailySpecialsPromise = loadDailySpecials(db);
  const userPromise = locals.userId
    ? db
        .prepare(`SELECT display_name, email FROM users WHERE id = ? LIMIT 1`)
        .bind(locals.userId)
        .first<{ display_name: string | null; email: string | null }>()
    : Promise.resolve(null);
  const todayTasksPromise = locals.userId
    ? db
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
        .all<HomeTask>()
    : Promise.resolve({ results: [] as HomeTask[] });
  const todaySchedulePromise =
    locals.userId && db
      ? loadTodayShifts(db, locals.userId)
      : Promise.resolve([] as TodayShift[]);
  const tempsPromise = db
    .prepare(
      `
      SELECT sensor_id, temperature, ts
      FROM temps
      ORDER BY ts DESC
      LIMIT ?
      `
    )
    .bind(HOMEPAGE_TEMP_LIMIT)
    .all<TempRow>();
  const [
    reviewEnabled,
    nodeTable,
    announcement,
    employeeSpotlight,
    dailySpecials,
    user,
    taskResult,
    todaySchedule,
    tempsResult
  ] = await Promise.all([
    reviewEnabledPromise,
    nodeTablePromise,
    announcementPromise,
    employeeSpotlightPromise,
    dailySpecialsPromise,
    userPromise,
    todayTasksPromise,
    todaySchedulePromise,
    tempsPromise
  ]);

  const userName = user?.display_name || user?.email || 'Team';
  const todayTasks = taskResult.results ?? [];

  const assignedCount = todayTasks.filter((task) => task.assigned_to === locals.userId).length;
  const unassignedCount = todayTasks.filter((task) => task.assigned_to === null).length;

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

  const rows = tempsResult.results ?? [];
  const latestBySensor = new Map<number, TempRow>();
  for (const row of rows) {
    if (!latestBySensor.has(row.sensor_id)) {
      latestBySensor.set(row.sensor_id, row);
      if (latestBySensor.size >= 3) break;
    }
  }
  const nodeTemps = Array.from(latestBySensor.values()).sort((a, b) => a.sensor_id - b.sensor_id);

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

  return {
    isAdmin,
    userName,
    announcement,
    employeeSpotlight,
    dailySpecials,
    todayTasks,
    todaySchedule,
    todayMeta: { assignedCount, unassignedCount },
    topIdeas: (topIdeasResult.results ?? []).map((r) => ({ text: r.content, votes: r.votes })),
    nodeTemps: nodeTemps.map((r) => ({
      sensorId: r.sensor_id,
      nodeName: namesBySensor.get(r.sensor_id) ?? null,
      temperature: r.temperature,
      ts: r.ts
    })),
    tempSeries: { avg },
    refreshedAt: Math.floor(Date.now() / 1000)
  };
};
