import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/admin.ts';
import { ensureBusinessSchema } from '#lib/server/business.ts';
import { normalizeFormText } from '#lib/server/inputSanitizer.ts';
import { hasBusinessCapability } from '#lib/server/permissions.ts';
import { getBusinessTrialAccess } from '#lib/server/trial.ts';
import { readBusinessEntitlements, readStoreBillingPlaceholder } from '#lib/server/storeBilling.ts';
import { businessTimeZoneOptions, normalizeTimeZone } from '#lib/timeZones.ts';

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
  timeZone: string;
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
  addressCountry: '',
  timeZone: 'UTC'
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
    return {
      business: {
        displayName: locals.businessName ?? '',
        logoUrl: locals.businessLogoUrl ?? null
      },
      registry: emptyRegistry,
      timeZones: businessTimeZoneOptions(),
      billing: null,
      canManageBilling
    };
  }

  await ensureBusinessSchema(db);
  const business = await db
    .prepare(
      `
      SELECT
        name,
        sidebar_logo_url,
        plan_tier,
        status,
        addon_temp_monitoring,
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
        address_country,
        time_zone
      FROM businesses
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(locals.businessId)
    .first<{
      name: string;
      sidebar_logo_url: string | null;
      plan_tier: string;
      status: string;
      addon_temp_monitoring: number;
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
      time_zone: string;
    }>();

  let billing: {
    planTier: string;
    status: string;
    store: string | null;
    currentPeriodEnd: number | null;
    autoRenewing: boolean | null;
    temperatureMonitoring: boolean;
    registeredSensors: number;
  } | null = null;

  if (canManageBilling && business) {
    const [trial, entitlements, placeholder] = await Promise.all([
      getBusinessTrialAccess(db, locals.businessId),
      readBusinessEntitlements(db, locals.businessId),
      readStoreBillingPlaceholder(db, locals.businessId)
    ]);
    const currentEntitlement =
      entitlements.find((entry) => entry.plan_tier && entry.status === 'active') ??
      entitlements.find((entry) => entry.plan_tier && entry.status === 'grace_period') ??
      entitlements.find((entry) => entry.plan_tier && entry.status === 'past_due') ??
      entitlements.find((entry) => entry.status === 'active') ??
      entitlements[0] ??
      null;
    let registeredSensors = 0;
    try {
      const sensorCount = await db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM temperature_sensor_nodes
           WHERE business_id = ? AND is_active = 1`
        )
        .bind(locals.businessId)
        .first<{ count: number }>();
      registeredSensors = Number(sensorCount?.count ?? 0);
    } catch {
      registeredSensors = 0;
    }

    billing = {
      planTier: currentEntitlement?.plan_tier ?? placeholder?.plan_tier ?? business.plan_tier,
      status: currentEntitlement?.status ?? placeholder?.status ?? trial.mode ?? business.status,
      store: currentEntitlement?.store ?? placeholder?.preferred_store ?? null,
      currentPeriodEnd: currentEntitlement?.current_period_end ?? trial.trialEndsAt,
      autoRenewing: currentEntitlement ? currentEntitlement.auto_renewing === 1 : null,
      temperatureMonitoring:
        business.addon_temp_monitoring === 1 ||
        entitlements.some(
          (entry) =>
            entry.addon_temp_monitoring === 1 &&
            (entry.status === 'active' || entry.status === 'grace_period')
        ),
      registeredSensors
    };
  }

  return {
    business: {
      displayName: business?.name ?? locals.businessName ?? '',
      logoUrl: business?.sidebar_logo_url ?? locals.businessLogoUrl ?? null
    },
    timeZones: businessTimeZoneOptions(),
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
      addressCountry: business?.address_country ?? '',
      timeZone: business?.time_zone ?? 'UTC'
    } satisfies RegistryPayload,
    billing,
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
    const timeZone = formData.has('time_zone') ? normalizeTimeZone(formData.get('time_zone')) : null;
    if (formData.has('time_zone') && !timeZone) return fail(400, { error: 'Select a valid time zone.' });

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
          time_zone = COALESCE(?, time_zone),
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
        timeZone,
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
