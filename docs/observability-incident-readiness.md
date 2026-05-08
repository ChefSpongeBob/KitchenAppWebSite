# Observability And Incident Readiness

Phase 10 adds production incident signal and operating procedure.

## Structured Logs
- Server logs are JSON lines from `src/lib/server/observability.ts`.
- Account/admin actions emit `account_audit_log` through the central audit writer.
- Billing conversion/cancellation emits billing lifecycle events.
- Tenant and feature access denials emit `tenant_access_denied`.
- Schema readiness failures emit `schema_readiness_failed`.
- Private document/camera media failures emit media-specific events.

## Alert Targets
- D1 overload: alert on repeated `request_guard_error`, D1 timeout messages, or high 5xx rate.
- Failed migrations: alert when `schema_readiness_failed` appears after deploy.
- Auth spikes: alert on repeated `account_audit_log` actions ending in failed/rate-limited.
- Media failures: alert on repeated `document_media_*` or `camera_media_*` failures.
- Billing lifecycle: alert on `billing_conversion_failed` or `billing_cancel_failed`.

## Production Smoke
- Run `npm run schema:readiness:prod` after migrations and before traffic.
- Run `npm run smoke:prod` after deploy.
- Set `SMOKE_INTERNAL_TOKEN`.
- Set `SMOKE_EMAIL` for a known smoke account.
- Set `SMOKE_ADMIN=1` when the smoke user should reach admin routes.

## Backup And Restore
- Before destructive tenant lifecycle actions, the app writes a pre-purge lifecycle snapshot.
- Before production migrations, export D1 using Cloudflare dashboard or Wrangler.
- For R2, verify bucket object access and retain business-scoped object prefixes.
- Restore path should prefer forward-fix SQL plus R2 object recovery from the latest known-good bucket state.

## Incident Checklist
- Capture exact timestamp with timezone.
- Capture route/action and affected business ID.
- Capture current commit/deploy ID.
- Check Cloudflare logs by `request_id`, `business_id`, `user_id`, and event name.
- Check `account_audit_logs` for auth/admin/security events.
- Run schema readiness before assuming code is broken.
- Record the root cause and fix in `docs/PROJECT_HANDOFF.md`.
