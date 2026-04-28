import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

type SectionRow = {
  slug: string;
  title: string;
  description: string | null;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) throw error(503, 'Database binding is missing.');
  const businessId = locals.businessId ?? '';

  const result = await db
    .prepare(
      `
      SELECT slug, title, description
      FROM list_sections
      WHERE domain = 'preplists'
        AND business_id = ?
      ORDER BY slug ASC
    `
    )
    .bind(businessId)
    .all<SectionRow>();

  return {
    sections: (result.results ?? []).map((s) => ({
      ...s,
      href: `/lists/preplists/${encodeURIComponent(s.slug)}`
    }))
  };
};
