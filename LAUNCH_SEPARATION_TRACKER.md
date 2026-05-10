# Launch Separation Tracker

Use this file as the single source of truth for getting this project launched as a fully separate entity.

## Rules (Lock These In)
- Do not run remote DB commands unless explicitly approved in chat.
- Keep Crimini by NNS, LLC footer/legal identity intact.
- Treat the live homepage hold screen as intentional until legal/store launch work is complete.

## Current Goal
Ship Crimini as its own production product with separate Cloudflare resources, tenant-safe data, and controlled public launch timing.

## How Next Step Is Chosen
The next step is always the first unchecked item in **Today Critical Path**.

## Today Critical Path
- [x] 1. Create new Cloudflare resource map.
- [x] 2. Update `wrangler.jsonc` bindings to Crimini D1/R2 resources.
- [x] 3. Attach project to GitHub and Cloudflare Pages.
- [x] 4. Attach live domain `criminiops.com`.
- [x] 5. Replace old public homepage with temporary visitor hold screen.
- [x] 6. Remove old copied public guide/static artifacts.
- [ ] 7. Add final store/copyright/legal launch assets.
- [ ] 8. Set production secrets needed for smoke/email flows.
- [ ] 9. Run live production smoke with `SMOKE_INTERNAL_TOKEN`.

## National-Scale Production Hardening Addendum

Goal: harden this app as a serious multi-tenant restaurant platform, not just a single-location app. This assumes paid Cloudflare for launch and prioritizes tenant isolation, security, scale, and operational reliability.

### Phase 1 - Tenant Authority Lockdown
- [x] Make `business_users.role` the only source of admin/business authority.
- [x] Remove dependency on global `users.role` for admin access decisions.
- [x] Add a single helper for effective permissions: owner/admin/manager/staff.
- [x] Update all `requireAdmin` and route guards to use business-scoped role.
- [x] Add tests proving a global user record cannot grant admin access outside its business.

Acceptance check:
- A user only has admin powers inside businesses where `business_users.role` is owner/admin/manager.
- A staff user cannot access `/admin`, admin actions, billing management, user management, creator, schedule admin, docs admin, or camera admin.

### Phase 2 - Explicit Workspace Context
- [x] Add an active workspace selector for users attached to multiple businesses.
- [x] Store active business selection in a safe session-scoped value.
- [x] Ensure login lands in the selected/default workspace.
- [x] Add "switch workspace" flow without leaking data from the previous workspace.
- [x] Add guardrails for deactivated memberships.

Acceptance check:
- One user can belong to multiple businesses and switch intentionally.
- Every page/action uses the active selected business, not whichever membership is first.

### Phase 3 - Tenant Isolation Audit
- [x] Audit every page load, form action, endpoint, and helper for `business_id`.
- [x] Create a tenant isolation checklist for each major area:
  - [x] Auth/session
  - [x] Admin dashboard
  - [x] App homepage
  - [x] Users/invites/onboarding
  - [x] Schedule/admin schedule/my schedule
  - [x] Lists/prep lists/orders/inventory/checklists
  - [x] Recipes
  - [x] Docs/menus/media
  - [x] Todos
  - [x] Whiteboard
  - [x] Announcements/spotlight
  - [x] Temps/sensors
  - [x] Cameras/media/activity
  - [x] Billing/trial/legal agreements
- [ ] Add automated cross-tenant tests with two businesses, two admins, and two staff users.

Acceptance check:
- Business A cannot read, edit, delete, upload, approve, invite, schedule, or view data from Business B.

### Phase 4 - IoT, Camera, And Sensor Security
- [x] Replace shared `IOT_API_KEY` with per-business or per-device ingest keys.
- [x] Store hashed ingest keys, not plaintext keys.
- [x] Require device records to be assigned to one business before accepting data.
- [x] Reject `x-business-id` if it does not match the device key owner.
- [x] Add key rotation/revoke flow in admin camera/sensors.
- [x] Add rate limits per device/business for temp and camera endpoints.
- [x] Keep camera beta disabled until this phase is complete.

Acceptance check:
- A leaked device key can only write for its assigned business/device and can be revoked without affecting other restaurants.

### Phase 5 - Media Access Hardening
- [x] Protect camera media behind session/business authorization.
- [x] Store camera object keys under business-scoped paths.
- [x] Verify document media remains business-scoped.
- [x] Verify onboarding media allows only the employee or business admin.
- [x] Add no-cache/private headers where files contain private employee/security data.

Acceptance check:
- A direct camera/document/onboarding media URL does not expose another business's file.

### Phase 6 - Production Schema Discipline
- [x] Move runtime schema mutation out of normal production request flow.
- [x] Keep migrations as the source of truth.
- [x] Convert `ensureTenantSchema`/runtime `ALTER TABLE` patterns into deploy-time checks where possible.
- [x] Add a production migration verification command to the deploy playbook.
- [x] Add a startup/readiness check that reports missing schema without mutating production.

Acceptance check:
- Normal production traffic does not perform schema-altering SQL.

### Phase 7 - Scale And Performance
- [x] Profile high-traffic pages for D1 row reads/writes.
- [x] Add or verify indexes for common `business_id` + date/status/user lookups.
- [x] Review admin dashboard queries for row scans.
- [x] Review schedule queries for week/business/user indexes.
- [x] Review temp/camera retention and cleanup queries.
- [x] Add pagination or date windows where lists could grow large.
- [x] Decide when to split noisy data into separate D1 databases or Durable Objects.

Acceptance check:
- Core pages stay fast with at least 50 businesses, 2,500 users, active schedules, docs, lists, temps, and onboarding records.

### Phase 8 - Auth, Abuse, And Account Safety
- [x] Add login rate limiting by IP and email.
- [x] Add password reset rate limiting.
- [x] Add invite creation limits per business/admin.
- [x] Add account/session audit logs.
- [x] Add session revocation controls for admins/users.
- [x] Confirm password policy is acceptable for business use.
- [x] Add suspicious activity logging for repeated failures.

Acceptance check:
- Brute force, invite spam, reset abuse, and stolen sessions are detectable and limited.

### Phase 9 - Billing, Trial, And Tenant Lifecycle
- [x] Ensure trial denial records cannot be bypassed by duplicate signups.
- [x] Verify cancellation purges only the canceled business data.
- [x] Verify paid conversion preserves all tenant data.
- [x] Add business export/backup plan before destructive cancellation.
- [x] Add clear status states: trialing, active, past_due, canceled, suspended.

Acceptance check:
- Billing/trial actions never affect another business and do not accidentally delete shared/global user accounts.

### Phase 10 - Observability And Incident Readiness
- [x] Add structured server logs for auth, admin actions, billing, DB errors, and tenant access denials.
- [x] Add production smoke tests for critical user/admin paths.
- [x] Add error alerting for D1 overload, failed migrations, auth spikes, and media access failures.
- [x] Add backup/restore procedure for D1 and R2.
- [x] Add incident checklist to `docs/release-deploy-playbook.md`.

Acceptance check:
- If production breaks, we can identify the route, tenant, user, action, timestamp, and likely failure cause quickly.

### Phase 11 - Launch Load Test
- [ ] Create seed/load script for 50 businesses with 8 admins and 42 users each.
- [ ] Seed schedules, lists, docs, menus, recipes, todos, onboarding, temps, and camera events.
- [ ] Run local/staging smoke against seeded data.
- [ ] Record page timings and D1 usage metrics.
- [ ] Fix any route with excessive row reads or slow queries.

Acceptance check:
- The app remains usable under realistic multi-business data volume before public launch.

## Required Inputs From You
- New production domain:
- New Cloudflare Pages/Worker project name:
- New D1 database name + ID:
- New R2 bucket name:
- App identities (iOS bundle ID / Android package name):

## Notes / Decisions Log
- 2026-04-24: Goal confirmed: fully separate from original project; footer stays unchanged.
- 2026-05-07: Added national-scale hardening addendum. Paid Cloudflare is expected for launch; focus is tenant isolation, per-business security, scale, and operational reliability.
- 2026-05-07: Started Phase 1 hardening. App/admin authority now derives from active `business_users.role`; global `users.role` no longer grants in-business admin access. `npm run check` and `npm run build` passed.
- 2026-05-07: Added `npm run test:tenant-authority` guard to prevent global `users.role` from regaining admin authority. Phase 1 is complete.
- 2026-05-07: Completed Phase 2 active workspace context. Multi-business users now get an explicit selected business cookie verified against active membership before tenant data loads, plus a compact sidebar switcher when more than one active business is available. `npm run test:tenant-authority`, `npm run check`, and `npm run build` passed.
- 2026-05-07: Completed Phase 3 tenant isolation audit in `docs/tenant-isolation-audit.md`. Camera media is now authenticated/business-scoped, camera uploads use business-owned object keys, public device ingest no longer guesses tenant context, and announcements/spotlight now prefer `business_id`. Added `npm run test:tenant-isolation`. `npm run test:tenant-isolation`, `npm run test:tenant-authority`, `npm run check`, and `npm run build` passed.
- 2026-05-07: Completed Phase 4 IoT hardening. Added `iot_devices`, hashed per-device ingest keys, admin provisioning/revoke in Camera & Sensors, per-device auth for temp/camera ingest, device/business mismatch rejection, and `npm run test:iot-device-auth`. `npm run test:iot-device-auth`, `npm run check`, and `npm run build` passed.
- 2026-05-07: Completed Phase 5 media access hardening. Document/onboarding uploads now use business-scoped object paths, document media uses only `DOC_MEDIA`, media reads require the active business session, onboarding media is limited to the employee or business admin, and private media responses use `private, no-store`. Added `npm run test:media-access`. `npm run test:media-access`, `npm run test:tenant-isolation`, `npm run check`, and `npm run build` passed.
- 2026-05-07: Completed Phase 6 production schema discipline. Production requests now wrap D1 with a schema-mutation guard unless `ALLOW_RUNTIME_SCHEMA_MUTATION=true`, `ensureTenantSchema` verifies instead of altering in production, and `/api/internal/schema-readiness` reports missing schema via `SMOKE_INTERNAL_TOKEN`. Added `npm run test:production-schema` and `npm run schema:readiness:prod`; deploy playbook now requires schema verification before traffic. `npm run test:production-schema`, `npm run check`, and `npm run build` passed.
- 2026-05-07: Completed Phase 7 scale/performance pass. Added `migrations/0053_scale_performance_indexes.sql` for tenant/date/status/user hot paths, documented reviewed query areas in `docs/scale-performance-audit.md`, batched temp and camera retention cleanup, and added `npm run test:scale-performance`. Temps and camera events are the first candidates for separate storage/Durable Objects if write volume becomes noisy. `npm run test:scale-performance`, `npm run check`, and `npm run build` passed.
- 2026-05-08: Completed Phase 8 auth/abuse/account safety. Added DB-backed rate limits, hashed audit logs, login/reset/signup/invite abuse controls, session/device tracking, user/admin session revocation, and stronger password policy. Added `migrations/0054_auth_abuse_account_safety.sql`, `docs/auth-abuse-account-safety.md`, and `npm run test:auth-abuse`. `npm run test:auth-abuse`, `npm run check`, and `npm run build` passed.
- 2026-05-08: Completed Phase 9 billing/trial/tenant lifecycle. Free-trial identity claims are now recorded at trial grant time, duplicate trial attempts are denied before account creation, business lifecycle states are explicit, paid conversion preserves tenant data, and cancellation creates a pre-purge lifecycle snapshot before deleting only that business workspace. Added `migrations/0055_billing_trial_tenant_lifecycle.sql`, `docs/billing-trial-tenant-lifecycle.md`, and `npm run test:billing-lifecycle`. `npm run test:billing-lifecycle`, `npm run check`, and `npm run build` passed.
- 2026-05-08: Completed Phase 10 observability/incident readiness. Added structured JSON server logs, tenant/access denial logging, billing/media/schema readiness incident events, expanded production smoke coverage, D1/R2 backup notes, alert watchlist, and incident checklist. Added `docs/observability-incident-readiness.md` and `npm run test:observability`. `npm run test:observability`, `npm run check`, and `npm run build` passed.

## Quick Status
- Overall status: `IN_PROGRESS`
- Next step: `1. Create new Cloudflare resource map`
- Next hardening phase: `Phase 11 - Launch Load Test`
