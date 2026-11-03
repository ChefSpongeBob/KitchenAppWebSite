import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requirePlatformStaff, searchPattern, staffSearch } from '#lib/server/platformStaff.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requirePlatformStaff(locals);
  const q = staffSearch(url.searchParams.get('q'));
  const name = url.searchParams.get('afterName');
  const id = url.searchParams.get('afterId');
  if ((name === null) !== (id === null) || (name?.length ?? 0) > 300 || (id?.length ?? 0) > 80) error(400, 'Refresh the business search.');
  const filters: string[] = [];
  const values: string[] = [];
  if (q) { filters.push("(name LIKE ? ESCAPE '\\' OR id = ?)"); values.push(searchPattern(q), q); }
  const selection = 'SELECT id, name, slug, status, plan_tier FROM businesses';
  const prefix = filters.length ? filters.join(' AND ') + ' AND ' : '';
  // Separate equal-name and later-name seeks preserve the full composite-index cursor.
  const query = name !== null && id !== null
    ? `${selection} WHERE ${prefix}name = ? COLLATE NOCASE AND id > ?
       UNION ALL ${selection} WHERE ${prefix}name > ? COLLATE NOCASE
       ORDER BY name COLLATE NOCASE, id LIMIT 21`
    : `${selection} ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY name COLLATE NOCASE, id LIMIT 21`;
  const bindings = name !== null && id !== null ? [...values, name, id, ...values, name] : values;
  const result = await locals.DB.prepare(query).bind(...bindings)
    .all<{ id: string; name: string; slug: string; status: string; plan_tier: string }>();
  return { q, businesses: result.results.slice(0, 20), hasNext: result.results.length > 20,
    hasPrevious: name !== null, next: result.results.length > 20 ? { name: result.results[19].name, id: result.results[19].id } : null };
};
