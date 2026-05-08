import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireBusinessId } from '$lib/server/tenant';

type DocRow = {
  title: string;
  content: string | null;
  file_url: string | null;
  category: string;
  slug: string;
};

export const load: PageServerLoad = async ({ locals, params }) => {
  const db = locals.DB;
  if (!db) {
    throw error(503, 'Database is not configured.');
  }
  const businessId = requireBusinessId(locals);

  const doc = await db
    .prepare(
      `
      SELECT title, content, file_url, category, slug
      FROM documents
      WHERE slug = ? AND is_active = 1 AND business_id = ?
      LIMIT 1
      `
    )
    .bind(params.slug, businessId)
    .first<DocRow>();

  if (!doc) {
    throw error(404, 'Document not found.');
  }

  return { doc };
};

