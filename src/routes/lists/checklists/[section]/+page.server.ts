import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';

type ChecklistSectionRow = {
  slug: string;
  title: string;
};

const SHIFT_ORDER: Record<string, number> = {
  opening: 0,
  midday: 1,
  closing: 2
};

function toTitle(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shiftFromSlug(baseSlug: string, slug: string) {
  const suffix = slug.slice(baseSlug.length).replace(/^-/, '');
  return suffix || slug;
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const db = locals.DB;
  if (!db) return { title: toTitle(params.section), shifts: [] };

  const businessId = requireBusinessId(locals);
  const baseSlug = params.section;

  const rows = await db
    .prepare(
      `
      SELECT slug, title
      FROM checklist_sections
      WHERE business_id = ?
        AND (slug = ? OR slug LIKE ?)
      ORDER BY slug ASC
      `
    )
    .bind(businessId, baseSlug, `${baseSlug}-%`)
    .all<ChecklistSectionRow>();

  const sections = rows.results ?? [];
  if (sections.length === 0) {
    throw error(404, 'Checklist category not found.');
  }

  const shifts = sections
    .map((section) => {
      const shiftSlug = shiftFromSlug(baseSlug, section.slug);
      return {
        href: `/lists/checklists/${encodeURIComponent(baseSlug)}/${encodeURIComponent(shiftSlug)}`,
        title: toTitle(shiftSlug),
        description: section.title
      };
    })
    .sort((a, b) => {
      const aKey = a.href.split('/').pop() ?? '';
      const bKey = b.href.split('/').pop() ?? '';
      return (SHIFT_ORDER[aKey] ?? 99) - (SHIFT_ORDER[bKey] ?? 99) || a.title.localeCompare(b.title);
    });

  return {
    title: toTitle(baseSlug),
    shifts
  };
};
