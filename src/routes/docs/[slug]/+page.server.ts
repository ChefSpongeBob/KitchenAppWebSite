import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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

  const doc = await db
    .prepare(
      `
      SELECT title, content, file_url, category, slug
      FROM documents
      WHERE slug = ? AND is_active = 1
      LIMIT 1
      `
    )
    .bind(params.slug)
    .first<DocRow>();

  if (!doc) {
    throw error(404, 'Document not found.');
  }

  return { doc };
};

