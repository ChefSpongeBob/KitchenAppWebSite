import type { PageServerLoad } from './$types';

type SectionRow = {
  slug: string;
  title: string;
  description: string | null;
};

const hrefBySlug: Record<string, string> = {
  kitchen: '/lists/preplists/kitchen',
  fish: '/lists/preplists/opener',
  veg: '/lists/preplists/sushi',
  sushi: '/lists/preplists/sushiprep'
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { sections: [] };

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
      href: hrefBySlug[s.slug] ?? '/lists/preplists'
    }))
  };
};
