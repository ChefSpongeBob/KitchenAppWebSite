import type { PageServerLoad } from './$types';
import { ensureTenantSchema } from '$lib/server/tenant';

type NodeNameRow = {
  sensor_id: number;
  name: string;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { nodeNames: [] };
  const businessId = locals.businessId ?? '';

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
  await ensureTenantSchema(db, true);

  const result = await db
    .prepare(
      `
      SELECT sensor_id, name
      FROM sensor_nodes
      WHERE business_id = ?
      ORDER BY sensor_id ASC
      `
    )
    .bind(businessId)
    .all<NodeNameRow>();

  return {
    nodeNames: result.results ?? []
  };
};
