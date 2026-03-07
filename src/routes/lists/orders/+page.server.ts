import type { PageServerLoad } from './$types';

type SectionRow = {
  slug: string;
  title: string;
  description: string | null;
};

const hrefBySlug: Record<string, string> = {
  sysco: '/lists/orders/sysco_link',
  sfotw: '/lists/orders/sfotw',
  order1: '/lists/orders/order1',
  order2: '/lists/orders/order2',
  order3: '/lists/orders/order3'
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
      href: hrefBySlug[s.slug] ?? '/lists/orders'
    }))
  };
};
