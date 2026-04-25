import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  appFeatureDefinitions,
  isValidAppFeatureMode,
  type AppFeatureKey,
  type AppFeatureMode
} from '$lib/features/appFeatures';
import { requireAdmin } from '$lib/server/admin';
import { loadAppFeatureModes, saveAppFeatureModes } from '$lib/server/appFeatures';
import { ensureBusinessSchema } from '$lib/server/business';

const BRAND_MEDIA_PREFIX = '/api/documents/media/';

type RegistryPayload = {
  legalName: string;
  registryId: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
};

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

function toOptionalString(formData: FormData, key: string, maxLength: number) {
  return String(formData.get(key) ?? '').trim().slice(0, maxLength);
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeWebsite(raw: string) {
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
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
  const body = await file.arrayBuffer();

  await bucket.put(key, body, {
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
      },
      registry: {
        legalName: '',
        registryId: '',
        contactEmail: '',
        contactPhone: '',
        websiteUrl: '',
        addressLine1: '',
        addressLine2: '',
        addressCity: '',
        addressState: '',
        addressPostalCode: '',
        addressCountry: ''
      } satisfies RegistryPayload,
      features: appFeatureDefinitions.map((feature) => ({
        ...feature,
        mode: 'all' as AppFeatureMode
      }))
    };
  }

  await ensureBusinessSchema(db);
  const branding = locals.businessId
    ? await db
        .prepare(
          `
          SELECT
            name,
            sidebar_logo_url,
            legal_business_name,
            registry_id,
            contact_email,
            contact_phone,
            website_url,
            address_line_1,
            address_line_2,
            address_city,
            address_state,
            address_postal_code,
            address_country
          FROM businesses
          WHERE id = ?
          LIMIT 1
          `
        )
        .bind(locals.businessId)
        .first<{
          name: string;
          sidebar_logo_url: string | null;
          legal_business_name: string | null;
          registry_id: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          website_url: string | null;
          address_line_1: string | null;
          address_line_2: string | null;
          address_city: string | null;
          address_state: string | null;
          address_postal_code: string | null;
          address_country: string | null;
        }>()
    : null;

  const featureModes = await loadAppFeatureModes(db);
  return {
    branding: {
      businessName: branding?.name ?? locals.businessName ?? '',
      logoUrl: branding?.sidebar_logo_url ?? locals.businessLogoUrl ?? null
    },
    registry: {
      legalName: branding?.legal_business_name ?? '',
      registryId: branding?.registry_id ?? '',
      contactEmail: branding?.contact_email ?? '',
      contactPhone: branding?.contact_phone ?? '',
      websiteUrl: branding?.website_url ?? '',
      addressLine1: branding?.address_line_1 ?? '',
      addressLine2: branding?.address_line_2 ?? '',
      addressCity: branding?.address_city ?? '',
      addressState: branding?.address_state ?? '',
      addressPostalCode: branding?.address_postal_code ?? '',
      addressCountry: branding?.address_country ?? ''
    } satisfies RegistryPayload,
    features: appFeatureDefinitions.map((feature) => ({
      ...feature,
      mode: featureModes[feature.key]
    }))
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
  },
  save_registry: async ({ request, locals }) => {
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
    const legalName = toOptionalString(formData, 'legal_name', 120);
    const registryId = toOptionalString(formData, 'registry_id', 80);
    const contactEmail = toOptionalString(formData, 'contact_email', 120).toLowerCase();
    const contactPhone = toOptionalString(formData, 'contact_phone', 48);
    const websiteRaw = toOptionalString(formData, 'website_url', 180);
    const addressLine1 = toOptionalString(formData, 'address_line_1', 120);
    const addressLine2 = toOptionalString(formData, 'address_line_2', 120);
    const addressCity = toOptionalString(formData, 'address_city', 80);
    const addressState = toOptionalString(formData, 'address_state', 80);
    const addressPostalCode = toOptionalString(formData, 'address_postal_code', 24);
    const addressCountry = toOptionalString(formData, 'address_country', 80);

    if (contactEmail && !looksLikeEmail(contactEmail)) {
      return fail(400, { error: 'Enter a valid business contact email.' });
    }

    const websiteUrl = normalizeWebsite(websiteRaw);
    if (websiteRaw && !websiteUrl) {
      return fail(400, { error: 'Enter a valid website URL.' });
    }

    await db
      .prepare(
        `
        UPDATE businesses
        SET
          legal_business_name = ?,
          registry_id = ?,
          contact_email = ?,
          contact_phone = ?,
          website_url = ?,
          address_line_1 = ?,
          address_line_2 = ?,
          address_city = ?,
          address_state = ?,
          address_postal_code = ?,
          address_country = ?,
          updated_at = ?
        WHERE id = ?
        `
      )
      .bind(
        legalName || null,
        registryId || null,
        contactEmail || null,
        contactPhone || null,
        websiteUrl || null,
        addressLine1 || null,
        addressLine2 || null,
        addressCity || null,
        addressState || null,
        addressPostalCode || null,
        addressCountry || null,
        Math.floor(Date.now() / 1000),
        locals.businessId
      )
      .run();

    return {
      success: true,
      message: 'Business registry information updated.'
    };
  },
  save: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) {
      return fail(503, { error: 'Database is not configured.' });
    }

    const formData = await request.formData();
    const nextModes: Partial<Record<AppFeatureKey, AppFeatureMode>> = {};
    for (const feature of appFeatureDefinitions) {
      const value = String(formData.get(`feature_${feature.key}`) ?? '').trim();
      if (!isValidAppFeatureMode(value)) {
        return fail(400, { error: `Invalid mode selected for ${feature.label}.` });
      }
      nextModes[feature.key] = value;
    }

    await saveAppFeatureModes(db, nextModes, locals.userId ?? null);
    locals.featureModes = await loadAppFeatureModes(db);

    return {
      success: true,
      message: 'App feature settings saved.'
    };
  }
};
