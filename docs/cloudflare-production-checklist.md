# Cloudflare Production Checklist

Last updated: May 15, 2026

## Project

- Domain: `https://criminiops.com`
- Cloudflare Pages project: `criminikitchenappwebsite`
- Wrangler app name: `criminikitchenapp`
- Pages output directory: `.svelte-kit/cloudflare`
- Compatibility flag: `nodejs_compat`
- D1 binding: `DB`
- D1 database: `crimini-production`
- R2 document binding: `DOC_MEDIA`
- R2 document bucket: `crimini-doc-media`
- R2 camera binding: `CAMERA_MEDIA`
- R2 camera bucket: `crimini-camera-media`

## Required Bindings

Cloudflare Pages must have these production bindings:

```txt
DB = crimini-production
DOC_MEDIA = crimini-doc-media
CAMERA_MEDIA = crimini-camera-media
```

## Required Variables

```txt
APP_BASE_URL=https://criminiops.com
```

## Required Secrets

Set Pages secrets against the Pages project name:

```powershell
npx wrangler pages secret put SECRET_NAME --project-name criminikitchenappwebsite
```

```txt
SMOKE_INTERNAL_TOKEN=
BILLING_WEBHOOK_TOKEN=
APP_STORE_BUNDLE_ID=com.nexusnorthsystems.crimini
APP_STORE_ISSUER_ID=
APP_STORE_KEY_ID=
APP_STORE_PRIVATE_KEY=
APP_STORE_ENVIRONMENT=production
GOOGLE_PLAY_PACKAGE_NAME=com.nexusnorthsystems.crimini
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=
```

Optional email automation:

```txt
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_REPLY_TO_EMAIL=
```

## Remote D1 Migrations

Use the `DB` binding, not the old copied project names.

```powershell
npm run db:migrations:apply:remote
```

If Wrangler returns authorization error `7403`, fix the Cloudflare token/account permission before continuing. The token must be scoped to the account that owns `crimini-production` and allow D1 edits.

## Production Verification

```powershell
npm run test:cloudflare-readiness
npm run test:security-headers
npm run test:production-schema
npm run test:tenant-isolation
npm run test:iot-device-auth
npm run test:media-access
npm run test:billing-lifecycle
npm run schema:readiness:prod
npm run smoke:prod
```

Do not open production traffic until schema readiness passes.

## External Systems Before Live Testing

- Email can be tested manually without Resend, but automated invite and reset emails require `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- Temperature ingestion requires a sensor device created in admin Camera & Sensors; use the generated per-device key, not a shared environment secret.
- Camera ingestion requires a camera device created in admin Camera & Sensors and the `CAMERA_MEDIA` R2 binding.
- Store billing requires the App Store and Google Play product IDs from `docs/store-billing-setup.md` plus the billing secrets above.
- Employee tax, bank, and identity data should not be collected with real personal data until field-level encryption is finished.

## Global Response Headers

The app sets production security headers in `src/hooks.server.ts`:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
