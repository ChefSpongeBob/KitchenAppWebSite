# Release Deploy Playbook

Use this as the default runbook for pushing web + DB safely.

## 1) Pre-Deploy Gate
- Pull latest `main`.
- Run:
  - `npm run check`
  - `npm run build`
  - `npm run mobile:check`
  - `npm run native:prereq`
  - `npm run test:production-schema`
  - `npm run test:scale-performance`
  - `npm run test:auth-abuse`
  - `npm run test:billing-lifecycle`
  - `npm run test:store-release`
  - `npm run test:cloudflare-readiness`
  - `npm run test:security-headers`
  - `npm run test:observability`
- Confirm feature flags for this release:
  - `PUBLIC_CAMERA_BETA_ENABLED` (default should stay `false` until camera is approved).

## 2) Database Safety
- Validate production DB access:
  - `npx wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`
- Create/confirm backup before migrations:
  - Export D1 from Cloudflare dashboard or Wrangler.
  - Confirm R2 bucket names and business-scoped prefixes.
- Normalize migration tracking if needed:
  - `npm run db:migrations:normalize:remote`
- Apply required migrations before deploy:
  - `npm run db:migrations:apply:remote`
- Current required post-live migrations:
  - `0057_repair_todo_user_foreign_keys.sql`
  - `0058_account_deletion_requests.sql`
  - `0059_store_entitlements.sql`
  - `0060_schedule_resource_indexes.sql`
  - `0061_employee_hr_compliance_foundation.sql`
  - `0062_employee_invite_sensitive_vault.sql`
  - `0063_employee_compliance_onboarding_link.sql`
- Verify production schema readiness after migrations and before traffic:
  - Set `APP_BASE_URL` and `SMOKE_INTERNAL_TOKEN`
  - `npm run schema:readiness:prod`

## 2.5) Cloudflare Secrets
- Pages project name for secrets:
  - `criminikitchenappwebsite`
- Required before app-store billing can fully verify:
  - `APP_STORE_BUNDLE_ID`
  - `APP_STORE_ISSUER_ID`
  - `APP_STORE_KEY_ID`
  - `APP_STORE_PRIVATE_KEY`
  - `APP_STORE_ENVIRONMENT`
  - `GOOGLE_PLAY_PACKAGE_NAME`
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
  - `BILLING_WEBHOOK_TOKEN`
- Required for production smoke/schema checks:
  - `SMOKE_INTERNAL_TOKEN`
- Required before employee onboarding can collect sensitive personal, tax, bank, or identity records:
  - `SENSITIVE_DATA_KEY`
  - `SENSITIVE_DATA_KEY_VERSION`
- Optional email automation:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `RESEND_REPLY_TO_EMAIL`

## 3) Deploy
- Push code to `main`.
- Trigger production deploy (Cloudflare pipeline/worker deploy path).
- Confirm deployment version timestamp.

## 4) Post-Deploy Smoke (Production)
- Run:
  - `npm run smoke:prod`
- Preferred authenticated mode:
  - Set `SMOKE_INTERNAL_TOKEN` (and optional `SMOKE_EMAIL`) to use `/api/internal/smoke/session` auth bypass for smoke checks.
- Manual fallback when Cloudflare challenge blocks script auth:
  - Run checklist in `docs/prod-auth-smoke-manual.md`.
- Auth:
  - Login/logout
  - Password reset link flow
- Scheduling:
  - Admin: add employee, create shift, save draft, publish
  - Employee: `my-schedule` loads and shift updates/offers work
- Profile:
  - Save personal/contact info
  - Submit birthday edit request
- Admin:
  - Dashboard opens
  - Camera route blocked when beta flag is `false`

## 5) Rollback Plan
- App rollback:
  - Re-deploy last known good commit from `main` history.
- Flag rollback:
  - Set `PUBLIC_CAMERA_BETA_ENABLED=false` immediately if camera issues appear.
- DB rollback:
  - Prefer forward-fix with idempotent SQL.
  - Avoid destructive rollback SQL on production unless explicitly approved and backed up.

## 6) Incident Notes
- Capture:
  - failing route/action
  - exact timestamp/timezone
  - commit hash currently live
  - DB commands applied
- Query Cloudflare logs for structured event names:
  - `request_guard_error`
  - `schema_readiness_failed`
  - `tenant_access_denied`
  - `billing_conversion_failed`
  - `billing_cancel_failed`
  - `document_media_*`
  - `camera_media_*`
- Alert watchlist:
  - D1 timeout/overload messages
  - failed schema readiness after migration
  - login/reset/signup rate-limit spikes
  - repeated media object misses
  - billing lifecycle failures
- Add findings to `docs/PROJECT_HANDOFF.md` if they affect future releases.
- Use `docs/observability-incident-readiness.md` as the incident checklist.
