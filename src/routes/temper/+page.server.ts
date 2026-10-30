import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';
import { loadLatestTemperatureSnapshots } from '$lib/server/temperatureMonitoring';

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { nodes: [] };
  const businessId = requireBusinessId(locals);

  return {
    nodes: await loadLatestTemperatureSnapshots(db, businessId, 25)
  };
};
