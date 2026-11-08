import type { PageServerLoad } from './$types';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { documentFeatureKey } from '#lib/features/appFeatures.ts';
import { featureAccessForLocals } from '#lib/server/featureAccess.ts';

type DocRow = {
  title: string;
  content: string | null;
  file_url: string | null;
  category: string;
  slug: string;
  section: string;
};

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.DB;
  if (!db) return { doc: null };
  const businessId = requireBusinessId(locals);

  const doc = await db
    .prepare(
      `
      SELECT title, content, file_url, category, slug, section
      FROM documents
      WHERE slug = 'about' AND is_active = 1 AND business_id = ?
      LIMIT 1
      `
    )
    .bind(businessId)
    .first<DocRow>();

  return { doc: doc && featureAccessForLocals(locals)[documentFeatureKey(doc)] ? doc : null };
};
