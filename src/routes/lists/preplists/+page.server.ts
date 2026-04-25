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

  const result = await db
    .prepare(
      `
      SELECT slug, title, description
      FROM list_sections
      WHERE domain = 'preplists'
      ORDER BY slug ASC
    `
    )
    .all<SectionRow>();

  return {
    sections: (result.results ?? []).map((s) => ({
      ...s,
      href: `/lists/preplists/${encodeURIComponent(s.slug)}`
    }))
  };
};
