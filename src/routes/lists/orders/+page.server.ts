import type { PageServerLoad } from './$types';

type SectionRow = {
  slug: string;
  title: string;
  description: string | null;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { sections: [] };

  const result = await db
    .prepare(
      `
      SELECT slug, title, description
      FROM list_sections
      WHERE domain = 'orders'
      ORDER BY slug ASC
    `
    )
    .all<SectionRow>();

  return {
    sections: (result.results ?? []).map((s) => ({
      ...s,
      href: `/lists/orders/${encodeURIComponent(s.slug)}`
    }))
  };
};
