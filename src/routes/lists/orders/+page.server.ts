import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';

type SectionRow = {
  slug: string;
  title: string;
  description: string | null;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { sections: [] };
  const businessId = requireBusinessId(locals);

  const result = await db
    .prepare(
      `
      SELECT slug, title, description
      FROM list_sections
      WHERE domain = 'orders'
        AND business_id = ?
      ORDER BY slug ASC
    `
    )
    .bind(businessId)
    .all<SectionRow>();

  return {
    sections: (result.results ?? []).map((s) => ({
      ...s,
      href: `/lists/orders/${encodeURIComponent(s.slug)}`
    }))
  };
};
