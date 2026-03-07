import type { PageServerLoad } from './$types';

type NodeNameRow = {
  sensor_id: number;
  name: string;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { nodeNames: [] };

  const table = await db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'sensor_nodes'
      LIMIT 1
      `
    )
    .first<{ name: string }>();

  if (!table) return { nodeNames: [] };

  const result = await db
    .prepare(
      `
      SELECT sensor_id, name
      FROM sensor_nodes
      ORDER BY sensor_id ASC
      `
    )
    .all<NodeNameRow>();

  return {
    nodeNames: result.results ?? []
  };
};
