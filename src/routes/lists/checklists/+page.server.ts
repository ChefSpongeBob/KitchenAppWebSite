import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';

type ChecklistSectionRow = {
  slug: string;
  title: string;
};

function toTitle(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { sections: [] };
  const businessId = requireBusinessId(locals);

  const rows = await db
    .prepare(
      `
      SELECT slug, title
      FROM checklist_sections
      WHERE business_id = ?
      ORDER BY slug ASC
      `
    )
    .bind(businessId)
    .all<ChecklistSectionRow>();

  const sections = (rows.results ?? [])
    .map((row) => ({
      slug: row.slug,
      title: row.title || toTitle(row.slug),
      href: `/lists/checklists/${encodeURIComponent(row.slug)}`
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return { sections };
};
