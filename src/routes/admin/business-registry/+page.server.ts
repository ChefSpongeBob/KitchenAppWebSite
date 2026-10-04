import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { ensureBusinessSchema } from '$lib/server/business';
import { normalizeFormText } from '$lib/server/inputSanitizer';
import { hasBusinessCapability } from '$lib/server/permissions';

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

const emptyRegistry: RegistryPayload = {
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
};

function toOptionalString(formData: FormData, key: string, maxLength: number) {
  return normalizeFormText(formData, key, { maxLength });
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

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const canManageBilling = hasBusinessCapability(
    locals.businessRole,
    locals.businessPermissionTemplate,
    'manage_billing',
    locals.businessCapabilities
  );
  const db = locals.DB;

  if (!db || !locals.businessId) {
    return { registry: emptyRegistry, canManageBilling };
  }

  await ensureBusinessSchema(db);
  const business = await db
    .prepare(
      `
      SELECT
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
    }>();

  return {
    registry: {
      legalName: business?.legal_business_name ?? '',
      registryId: business?.registry_id ?? '',
      contactEmail: business?.contact_email ?? '',
      contactPhone: business?.contact_phone ?? '',
      websiteUrl: business?.website_url ?? '',
      addressLine1: business?.address_line_1 ?? '',
      addressLine2: business?.address_line_2 ?? '',
      addressCity: business?.address_city ?? '',
      addressState: business?.address_state ?? '',
      addressPostalCode: business?.address_postal_code ?? '',
      addressCountry: business?.address_country ?? ''
    } satisfies RegistryPayload,
    canManageBilling
  };
};

export const actions: Actions = {
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
  }
};
