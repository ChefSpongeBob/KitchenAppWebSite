import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';

type NodeNameRow = {
  sensor_id: number;
  name: string;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { nodeNames: [] };
  const businessId = requireBusinessId(locals);

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
