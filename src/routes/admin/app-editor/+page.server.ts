import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { ensureBusinessSchema } from '$lib/server/business';

const BRAND_MEDIA_PREFIX = '/api/documents/media/';

function mediaKeyFromUrl(url: string) {
  if (!url.startsWith(BRAND_MEDIA_PREFIX)) return null;
  const encoded = url.slice(BRAND_MEDIA_PREFIX.length).trim();
  if (!encoded) return null;
  return encoded
    .split('/')
    .map((part) => decodeURIComponent(part))
    .join('/');
}

function extensionFromFilename(name: string) {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot >= trimmed.length - 1) return '';
  return trimmed.slice(dot + 1).toLowerCase();
}

function extensionFromContentType(contentType: string) {
  if (contentType === 'image/jpeg' || contentType === 'image/pjpeg') return 'jpg';
  return '';
}

function isAllowedLogoUpload(contentType: string, extension: string) {
  const allowedExtensions = ['jpg', 'jpeg'];
  return contentType === 'image/jpeg' || contentType === 'image/pjpeg' || allowedExtensions.includes(extension);
}

async function uploadBrandLogo(
  bucket: NonNullable<App.Locals['MEDIA_BUCKET']>,
  businessId: string,
  file: File
) {
  const contentType = file.type || 'application/octet-stream';
  const filenameExtension = extensionFromFilename(file.name);
  const typeExtension = extensionFromContentType(contentType);
  const extension = filenameExtension || typeExtension || 'jpg';
  const key = `businesses/${businessId}/branding/sidebar-logo-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: contentType === 'image/pjpeg' ? 'image/jpeg' : contentType,
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });

  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return {
    key,
    url: `${BRAND_MEDIA_PREFIX}${encodedKey}`
  };
}

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      branding: {
        businessName: locals.businessName ?? '',
        logoUrl: locals.businessLogoUrl ?? null
      }
    };
  }

  await ensureBusinessSchema(db);
  const branding = locals.businessId
    ? await db
        .prepare(
          `
          SELECT name, sidebar_logo_url
          FROM businesses
          WHERE id = ?
          LIMIT 1
          `
        )
        .bind(locals.businessId)
        .first<{ name: string; sidebar_logo_url: string | null }>()
    : null;

  return {
    branding: {
      businessName: branding?.name ?? locals.businessName ?? '',
      logoUrl: branding?.sidebar_logo_url ?? locals.businessLogoUrl ?? null
    }
  };
};

export const actions: Actions = {
  save_branding: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) {
      return fail(503, { error: 'Database is not configured.' });
    }
    if (!locals.businessId) {
      return fail(400, { error: 'No active business was found for this account.' });
    }

    await ensureBusinessSchema(db);
    const formData = await request.formData();
    const businessName = String(formData.get('business_name') ?? '').trim();
    const removeLogo = String(formData.get('remove_logo') ?? '').trim() === '1';

    if (!businessName) {
      return fail(400, { error: 'Restaurant name is required.' });
    }
    if (businessName.length > 80) {
      return fail(400, { error: 'Restaurant name must be 80 characters or fewer.' });
    }

    const existing = await db
      .prepare(
        `
        SELECT sidebar_logo_url
        FROM businesses
        WHERE id = ?
        LIMIT 1
        `
      )
      .bind(locals.businessId)
      .first<{ sidebar_logo_url: string | null }>();

    let logoUrl = existing?.sidebar_logo_url ?? null;
    const existingKey = mediaKeyFromUrl(logoUrl ?? '');

    if (removeLogo) {
      if (existingKey && locals.MEDIA_BUCKET) {
        await locals.MEDIA_BUCKET.delete(existingKey);
      }
      logoUrl = null;
    }

    const upload = formData.get('sidebar_logo');
    if (upload instanceof File && upload.size > 0) {
      if (upload.size > 5 * 1024 * 1024) {
        return fail(400, { error: 'Logo upload must be 5MB or smaller.' });
      }

      const contentType = upload.type || 'application/octet-stream';
      const extension = extensionFromFilename(upload.name);
      if (!isAllowedLogoUpload(contentType, extension)) {
        return fail(400, { error: 'Logo must be a JPG image (.jpg or .jpeg).' });
      }

      if (!locals.MEDIA_BUCKET) {
        return fail(503, { error: 'Media bucket is not configured. Logo upload is unavailable.' });
      }

      const uploaded = await uploadBrandLogo(locals.MEDIA_BUCKET, locals.businessId, upload);
      if (existingKey && existingKey !== uploaded.key) {
        await locals.MEDIA_BUCKET.delete(existingKey);
      }
      logoUrl = uploaded.url;
    }

    await db
      .prepare(
        `
        UPDATE businesses
        SET name = ?, sidebar_logo_url = ?, updated_at = ?
        WHERE id = ?
        `
      )
      .bind(businessName, logoUrl, Math.floor(Date.now() / 1000), locals.businessId)
      .run();

    locals.businessName = businessName;
    locals.businessLogoUrl = logoUrl;

    return {
      success: true,
      message: 'Sidebar branding updated.'
    };
  }
};
