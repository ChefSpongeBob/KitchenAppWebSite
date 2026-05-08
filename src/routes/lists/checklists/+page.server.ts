import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';

type ChecklistSectionRow = {
  slug: string;
  title: string;
};

function normalizeChecklistPrefix(slug: string) {
  return slug.replace(/-(opening|midday|closing)$/i, '');
}

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

  const prefixMap = new Map<string, string>();
  for (const row of rows.results ?? []) {
    const prefix = normalizeChecklistPrefix(row.slug);
    if (!prefixMap.has(prefix)) {
      prefixMap.set(prefix, row.title || toTitle(prefix));
    }
  }

  const sections = Array.from(prefixMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([slug, title]) => ({
      slug,
      title,
      href: `/lists/checklists/${encodeURIComponent(slug)}`
    }));

  return { sections };
};
