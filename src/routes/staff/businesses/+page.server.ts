import type { PageServerLoad } from './$types';
import { requirePlatformStaff, searchPattern, staffPageNumber, staffSearch } from '$lib/server/platformStaff';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requirePlatformStaff(locals);
  const q = staffSearch(url.searchParams.get('q'));
  const page = staffPageNumber(url.searchParams.get('page'));
  const result = await locals.DB.prepare(`
    SELECT id, name, slug, status, plan_tier FROM businesses
    WHERE (? = '' OR name LIKE ? ESCAPE '\\' OR id = ?)
    ORDER BY name COLLATE NOCASE, id LIMIT 21 OFFSET ?
  `).bind(q, searchPattern(q), q, (page - 1) * 20)
    .all<{ id: string; name: string; slug: string; status: string; plan_tier: string }>();
  return { q, page, businesses: result.results.slice(0, 20), hasNext: result.results.length > 20 };
};
