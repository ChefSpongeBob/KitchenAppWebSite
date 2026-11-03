# Crimini Project Handoff

Use this as the single source of truth for continuing Crimini without guessing or branching into scattered checklists.

## Project

- Repo path: `c:\Users\spong\Desktop\SoftwareKitchenNNS`
- GitHub: `https://github.com/ChefSpongeBob/KitchenAppWebSite`
- Live domain: `https://criminiops.com`
- Current hold: public customer launch awaits legal/business approval. `criminiops.com` is online for controlled testing; public signup remains closed.
- Stack: SvelteKit, Cloudflare Pages, Cloudflare D1, Cloudflare R2, Capacitor.
- Product: Crimini by NNS, LLC.

## Working Rules

- Keep UI copy short. No obvious helper text or verbose subtitles.
- Do not rewrite large UI sections without a plan first.
- Every new or edited component must use the current Crimini UI system: cream, white, charcoal, mushroom branding, restrained surfaces, faded divider lines, compact controls, purposeful icons, and the established light/dark app themes.
- Do not introduce old rounded floating-card styling, glow-heavy panels, oversized buttons, nested cards, or unrelated visual patterns.
- Preserve responsive behavior for desktop and mobile whenever a component or page is changed.
- Do not run remote DB commands unless explicitly approved.
- Preserve business/tenant scoping on every page, action, upload, and endpoint.
- Manager authority comes from business membership role, not global user role.
- Every feature must be real: no false routes, hardcoded data, or UI-only plumbing.

## Core Wiring

- Auth/session guard: `src/hooks.server.ts`
- Permissions: `src/lib/server/permissions.ts`
- Business context: `src/lib/server/business.ts`
- Tenant schema/readiness: `src/lib/server/tenant.ts`
- Feature gating: `src/lib/server/appFeatures.ts`, `src/lib/features/appFeatures.ts`
- Admin operations: `src/lib/server/admin.ts`
- Scheduling: `src/lib/server/schedules.ts`
- IoT device auth: `src/lib/server/iotIngest.ts`
- Sensitive HR vault: `src/lib/server/sensitive.ts`
- Document media: `src/routes/api/documents/media/[...key]/+server.ts`

## Cloudflare

- Pages project: `criminikitchenappwebsite`
- Wrangler app name: `criminikitchenapp`
- D1 binding: `DB`
- D1 database: `crimini-production`
- R2 binding: `DOC_MEDIA`
- R2 bucket: `crimini-doc-media`
- Production base URL: `APP_BASE_URL=https://criminiops.com`
- Required secrets include `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `PASSWORD_PEPPER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_STORE_PRIVATE_KEY`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `BILLING_WEBHOOK_TOKEN`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`.
- Set `APP_STORE_DOWNLOAD_URL` and `GOOGLE_PLAY_DOWNLOAD_URL` only after the real public store listings exist; employee welcome screens never use placeholder listing links.
- Private testing lock: keep marketing public, set `PUBLIC_SIGNUP_ENABLED=false`, and set `OWNER_SIGNUP_ALLOWLIST` to comma-separated owner test emails. Public tenant creation stays closed unless explicitly enabled or allowlisted; invited users can still register through valid active-tenant invites.
- Login Turnstile is enabled automatically when both Turnstile secrets are present; local/dev remains open when they are absent.
- Cloudflare edge security before public launch: enable Managed WAF rules, OWASP managed rules where available, and rate limits/challenges for `/login`, `/register`, `/forgot-password`, `/account-deletion`, and public API abuse paths. Do not challenge token/device-auth service paths: billing webhooks, smoke/schema readiness, temperature ingest, temperature alert processing, and operational-event processing.
- Browser hardening is split by response type: dynamic app responses are handled in `src/hooks.server.ts`; static/edge responses are covered by root `_headers`.

## Validation Gates

Run local/static gates before pushes or large changes:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run mobile:check
npm.cmd run test:native-transport
npm.cmd run native:prereq
npm.cmd run android:release:check
npm.cmd run test:tenant-authority
npm.cmd run test:authorization-capabilities
npm.cmd run test:operational-events
npm.cmd run test:tenant-isolation
npm.cmd run test:db-governance
npm.cmd run test:iot-device-auth
npm.cmd run test:media-access
npm.cmd run test:production-schema
npm.cmd run test:scale-performance
npm.cmd run test:auth-abuse
npm.cmd run test:malicious-user-hardening
npm.cmd run test:hr-onboarding
npm.cmd run test:admin-consolidation
npm.cmd run test:core-feature-actions
npm.cmd run test:billing-lifecycle
npm.cmd run test:store-release
npm.cmd run test:cloudflare-readiness
npm.cmd run test:security-headers
npm.cmd run test:observability
npm.cmd run test:ui-polish
npm.cmd run test:apple-store
npm.cmd run test:google-play
npm.cmd run test:legal-readiness
npm.cmd run smoke:local
```

Run live gates against the controlled production deployment; these do not open public signup:

```powershell
npm.cmd run schema:readiness:prod
npm.cmd run smoke:prod
```

Equivalent package script names include `npm run test:cloudflare-readiness`, `npm run test:production-schema`, and `npm run schema:readiness:prod`.
Remote migration commands must use the active DB binding, for example `d1 execute DB --remote`.
Before production migrations, Create/confirm backup before migrations.

## Current Verified Areas

- Tenant authority checks pass; app role is derived from business membership.
- Tenant isolation checks pass for temperatures, announcements, and spotlight paths.
- IoT device auth uses per-device credentials, not shared API keys.
- Media access is private, business-scoped, and no-store.
- Production schema guard blocks runtime mutation in production.
- Scale/performance static checks pass.
- Auth abuse checks pass. Login attempts are rate-limited. Audit logs store hashed email/IP/user-agent values where appropriate.
- Billing lifecycle checks pass. Trial identity claims prevent free-trial reuse, and cancellation creates a pre-purge snapshot.
- Store release checks pass for current code wiring.
- Cloudflare readiness checks pass against current config.
- Security headers and observability checks pass.
- Temperature hardware uses separate Arduino sketches for ESP32-C6FH4 AHT20/BMP280 nodes and gateways. Nodes send short raw IEEE 802.15.4 bursts, setup uses only manually assigned serials, humidity is stored, and pressure is ignored.

## Store Billing

- Native app id / bundle id: `com.nexusnorthsystems.crimini`.
- Store products must be created in App Store Connect and Google Play before sandbox tests.
- Product IDs currently expected by the launch app/store plan include `crimini.plan.small.monthly`, `crimini.plan.medium.monthly`, `crimini.plan.large.monthly`, and the standalone `crimini.addon.temps.monthly`.
- Cloudflare Secrets must include App Store, Google Play, and billing webhook values before real purchase testing.
- Native purchase submissions stay pending until Apple/Google verification succeeds.
- Restore purchases path is wired but needs real device/store testing.
- App Store and Google Play privacy/data-safety answers must match actual app data collection.

## Observability And Incidents

- Structured Logs are emitted through the observability helper for auth, tenant denials, billing lifecycle failures, schema readiness failures, and media access failures.
- Alert Targets: `schema_readiness_failed`, `tenant_access_denied`, `billing_conversion_failed`, `billing_cancel_failed`, repeated 500s, and media access denials.
- Alert watchlist uses the same events above during deploy and smoke testing.
- Backup And Restore: export D1 before migrations or destructive tenant lifecycle changes; prefer forward-fix SQL plus R2 object recovery from latest known-good state.

## Current Progress

- Last full static validation: 2026-10-31, including the pre-framework real SQL/action, email, PDF, and namespace-migration regressions. Web/native UI builds and sync passed. This does not close the remaining dependency-security gate.
- Current repository status: functional foundations and staff-console code are validated, but dependency-security remediation and deployment/manual gates remain open. Do not interpret passing static tests as public-launch clearance.
- Current hold: public customer launch still waits for trademark/LLC timing, final legal/payroll review, store setup, and live operational integrations. Controlled live-domain testing is already available.
- Phase status: Phases 1-18 and code-readiness parts of 20-22 are locally validated by scripts. Store, native-device, legal, live-domain, hardware, and edge-dashboard items remain manual/external.
- The camera subsystem is not part of the launch application; its routes, bindings, purchase paths, and active UI have been removed.
- Launch pricing remains aligned: Small `$29/mo`, Medium `$49/mo`, and Large `$69/mo`. Temperature monitoring is an optional `$17/mo` add-on for up to 12 active sensors, plus `$2/mo` for every active sensor from 13 through the 25-sensor self-service ceiling.
- Turnstile login hardening is wired: login challenge appears only when `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are present, and server validation is fail-closed when configured.
- The only project completion/checklist file is this handoff. Do not create scattered task lists.

## Pre-Restaurant Data Entry Gate

Before entering information for three real restaurants, complete this gate in order:

1. Complete the dependency-security gate below, then run local/static validation: `npm.cmd run test:static`.
2. Confirm repo is pushed and Cloudflare deployment passed for the same commit you intend to test.
3. Enable private signup protection on the target environment with `PUBLIC_SIGNUP_ENABLED=false` and `OWNER_SIGNUP_ALLOWLIST` set to approved owner test emails.
4. Confirm Cloudflare bindings/secrets on the target environment: `DB`, `DOC_MEDIA`, `APP_BASE_URL`, `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `PASSWORD_PEPPER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, `BILLING_WEBHOOK_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `PUBLIC_SIGNUP_ENABLED`, and `OWNER_SIGNUP_ALLOWLIST`.
5. Create or confirm a D1 backup/export before loading real tenant data.
6. Run production schema readiness against the exact Pages environment being tested: `npm.cmd run schema:readiness:prod`.
7. Run production smoke against the exact Pages environment being tested: `npm.cmd run smoke:prod`.
8. Create at least two private validation businesses first and run the Manual Validation Matrix below against controlled validation data.
9. Only after private validation tenants pass, create the three restaurant tenants and enter real restaurant information.

If any gate item fails, stop real data entry and fix/debug before continuing.

## Validated Code Areas

Current scripts/builds cover the functional foundations below. This does not close dependency-security, deployment, or manual/external gates:

- Authorization, roles, business membership, capability gates, direct-route denial, and tenant context.
- Session lifecycle, login/logout, reset-password plumbing, account deletion request persistence, rate limits, same-origin mutation guard, security headers, Turnstile login validation, and malicious-user regression checks.
- Creator Studio as the single editor surface for categories, lists, recipes, documents, menus, and item attachments.
- Core app feature actions for lists, docs, menus, recipes, ToDo, whiteboard, specials, announcements, spotlight, vendors, reminders, tools, business registry, and waste tracking.
- Lists/history/report foundation, including checklist/prep/inventory/order list domains, item attachments, CSV hardening, and tenant-scoped report routes.
- Scheduling code foundation: departments, roles, availability, time off, templates, autosave drafts, publish, open shifts, offers, approvals, My Schedule, and bounded schedule/report queries.
- Employee invite/onboarding/HR code foundation: invite role paths, packet requirements, sensitive vault encryption, HR-sensitive permission checks, audited reads, onboarding reports, and private media.
- Email code foundation: branded transactional helper, Resend integration, invite/approval/password reset/onboarding/operational email event wiring, idempotency, and delivery failure logging.
- Native push registration foundation only: Capacitor plugin, token storage/revoke endpoints, user preferences, and native client registration plumbing. Server-side APNs/FCM delivery is not implemented and is deferred by the user; do not describe it as only waiting for credentials.
- Temperature monitoring code foundation: gateway/node serial model, device auth, tenant-scoped temperature/humidity ingest, packet sequence/nonce/LQI diagnostics, thresholds, alert events, automatic recovery, stale processor endpoint, history/report wiring, and bounded ingest.
- Billing/store lifecycle code foundation: native purchase submission, pending entitlements, Apple/Google verification paths, token-gated webhooks, entitlement reconciliation, and launch pricing.
- Cloudflare readiness: Pages config, D1/R2 bindings, schema guard, Node version, package lock, no old copied-app Cloudflare bindings, and deploy readiness checks.
- UI/readiness guards: current Crimini UI requirements, accessibility/focus checks, legal/support/public routes, Apple/Google readiness checks, and production build.

## Remaining Launch Work

Dependency security gate (2026-10-31, open): the initial baseline was 10 production/22 full-tree affected packages, including three critical. The pre-framework pass patches Capacitor to exact 8.4.3, PDF.js to exact 6.4.299, and compatible transitive serialization/archive/XML/CSS/HTTP dependencies. Final audit results are recorded at the checkpoint below; the baseline is not the current count. Framework/build-tool findings remain launch blockers until resolved or explicitly assessed. Deepmerge has no published patched release in the checked 4.x line; assess its build-config-only use rather than suppressing the alert. Audit findings are dependency flags, not proof of exploitation. No `audit fix --force`, incompatible CLI downgrade, or hidden findings. Maintainer references: https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv and https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j.

This is the only active completion list. Work it in order and do not create scattered task lists.

### Crimini Staff Console (Active Addition)

Complete this sequence without replacing the launch work below. Restaurant roles and platform staff authorization remain separate. Initial platform owner: the existing account `spongebobchefpants@gmail.com`, explicitly confirmed on 2026-10-31. No email allowlist, public signup, tenant role, or billing bypass may grant platform access.

1. Access foundation (code validated; manual review open): explicit platform membership, server guards on every staff page/action, existing session validation, fail-closed access, no-store responses, separate staff shell, controlled initial-owner grant, additive migrations, and platform-only audit records. Do not change normal restaurant access or hardware firmware.
2. Business lookup (code validated; manual review open): bounded searchable business directory and read-only account/subscription/equipment summaries. Never expose employee HR records, bank/tax/identity data, password hashes, device credentials, or store purchase tokens.
3. Equipment assignment (code validated; live concurrency/manual review open): searchable existing factory inventory, reserve an unclaimed gateway for a business, release an unused reservation, enforce reservations during tenant registration, reject cross-tenant/concurrent claims, and atomically audit changes. Preserve already registered equipment and the approved serial/Wi-Fi/node customer workflow. Factory firmware automation is deferred.
4. System health (code validated; manual review open): `/staff/health?business=<id>` shows bounded, read-only gateway freshness and queued-notification status/attempts with manual refresh. Owner/support can see delivery metadata; equipment staff see gateways only. No raw message bodies, recipients, payloads, provider errors/tokens, background polling, retries, dispatch triggers, or new telemetry retention. Direct invite/account emails are not covered by the operational queue; provider acceptance does not prove inbox delivery, and queue activity does not prove scheduled-worker uptime. Migration 0108 adds two business-scoped read indexes only; applied locally and in production after ignored `.db-backups/before-staff-health-20261031.sql` export. Integration tests cover tenant separation (including mismatched event/attempt business IDs), role denial, 20-row pagination, status boundaries, configuration-without-secret exposure, and indexed query plans. Production read-only gateway/queue/attempt SQL and both indexes were verified; no remote migrations remain pending. The full static suite and native build passed on 2026-10-31. Manual checks remain: owner/support/equipment views, both businesses, revoked staff, refresh/pagination/filter state, never-connected/offline/online gateways, future contact timestamps, failed/retrying/expired/delayed queue jobs, provider-acceptance wording, and responsive UI. This view is not a replacement for direct-email delivery tests or a real dispatcher heartbeat.
5. Staff controls (code validated; manual review open): owner-only `/staff/team` manages existing active accounts with owner/support/equipment scopes, explicit reasons, optimistic revisions, and atomic audit. Revocation invalidates platform access without changing restaurant roles/sessions; database guards prevent removing, disabling, or demoting the last active platform owner. `/staff/security` reconfirms the existing password and rotates the session token without extending expiry. Confirmation lasts eight hours for staff reads and 15 minutes for sensitive writes, bound to the primary session, user, and membership revision. Membership/account/password changes invalidate confirmation. No new account, password scheme, restaurant login requirement, HR access, self-registration, or self-promotion.
6. Maintenance safeguards (code validated; policy/manual review open): equipment/staff forms require confirmation and a reason, plus recent password confirmation. Mutations recheck authority/state in SQL and audit atomically. Inactive identities can have staff membership revoked without reactivating their login. Confirmation audit failure rolls back with a controlled 503 and no cookie change. No SQL UI, secret viewer, impersonation, tenant deletion, entitlement override, or HR access.
7. Completion gate: actual-SQL tests cover all eight staff paths, anonymous/nonstaff/forged-role/CSRF denial, owner/support/equipment actions, confirmation/reason/rate denial, inactive-user revocation, secret exclusion, tenant-selected data, pagination, expiry, stale authority, last-owner guards, and audit rollback. Tenant purge retains platform identities/audit without retaining ordinary removed tenant identities. Live UI and two-tenant/concurrency tests remain manual.

Staff Authentication Decision (2026-10-31):
- Temporary testing setup: the user explicitly rejected passkeys, authenticator applications, and replacement email codes. Staff access currently uses the existing account password plus password reconfirmation; this is NOT MFA or the final staff-security design. On 2026-10-31 the user requested a future security redesign while keeping current access simple. Do not change authentication or select a replacement method without explicit approval.
- Migration 0110 removes the rejected credential/challenge tables and obsolete proof column, invalidates existing staff confirmations, and preserves primary sessions, account credentials, memberships, last-owner guards, and audit history. Historical applied migrations remain immutable. Deploy the compatible password-only code before applying the cleanup to avoid breaking the previous staff implementation.
- Suspected staff compromise: another verified platform owner revokes affected staff membership and verifies denial. An authorized Cloudflare operator must independently verify and obtain approval for any sole-owner recovery; preserve audit evidence and never alter tenant roles or billing as a shortcut. Existing primary account/session compromise procedures still apply.
- Approve retention/export/deletion and incident procedures before launch; no arbitrary automatic audit deletion was introduced. Never enter secrets or employee HR data in maintenance reasons.

Current checkpoint:
- The staff/Wi-Fi foundation was pushed as `a0439a3`; live staff entry and login-form routing were verified. Manual authenticated access/UI review remains open.
- Password-only removal was pushed as `e6bfc51` on 2026-10-31. Full static regression, web/native builds, ordinary-form access/rollback/expiry tests, and a clean Linux-targeted npm 10.9.2 install (207 packages) passed. The production staff-security asset matched the validated build byte-for-byte before migration 0110 was applied remotely. Migration 0110 is applied locally and in production; obsolete tables/column are absent, foreign keys are clean, and account/business/membership/audit counts are unchanged. The production export is ignored `.db-backups/before-staff-password-only-20261031.sql`. No restaurant login, billing gate, tenant role, password hash, credential reset, or firmware change was made. Authenticated DuckDuckGo review remains manual.
- The approved owner remains the existing account `spongebobchefpants@gmail.com`. That email is absent locally: do not create a local identity, copy production inventory, or change local database targets.
- Manual gates: staff entry/sign-in/password confirmation in DuckDuckGo, cancelled navigation/retry/expired confirmation, owner/support/equipment/nonstaff views, multi-tab/device revocation, inactive-account revocation, audit readability, desktop/mobile layout, both-business equipment/health isolation, and real D1 concurrency. Confirm ordinary restaurant logins and billing restrictions are unchanged.
- Next coding phase remains the framework/dependency-security sequence below. Known dependency advisories are still open; no major upgrade, redesign, or hardware work is part of this removal.

Staff Completion And Security Redesign (Deferred; Required Before Launch):

1. Agree on the staff threat model, authentication method, enrollment, recovery, and user-facing wording before implementation. DuckDuckGo compatibility is mandatory; do not require additional applications, devices, passkeys, or emailed codes by assumption. Explain security tradeoffs and obtain approval for the final design.
2. Revalidate staff-only authorization, least-privilege roles, session expiry/rotation, sensitive-action confirmation, revocation across tabs/devices, brute-force limits, CSRF protection, and fail-closed database errors against that approved design. Preserve restaurant login, billing, tenant permissions, and the current owner account.
3. Finish manual owner/support/equipment/nonstaff checks on every staff route/action. Verify tenant-selected business and subscription summaries, denied direct URLs, no restaurant-role elevation into platform access, and no HR, device credentials, payment tokens, or other secrets in responses or logs.
4. Complete factory-inventory reservation/release and tenant equipment-claim testing with two businesses, concurrent requests, unavailable/already-claimed equipment, and Registered Equipment Wi-Fi setup. Preserve the approved customer workflow; manufacturing automation and firmware changes require separate approval.
5. Review staff page layout and health/status accuracy in DuckDuckGo on desktop/mobile. Verify filters, pagination, empty/error states, bounded indexed reads, secret-free delivery metadata, and no background polling. Do not present provider acceptance as delivery or queue activity as worker uptime.
6. Approve and rehearse sole-owner recovery, staff compromise response, backup/restore, and audit retention/export procedures. Keep recovery narrowly authorized and audited; no password-only public reset, impersonation, secret viewer, or tenant/billing override by assumption.
7. Run automated regression and live two-tenant/concurrency checks after the redesign; record actual results in this list. Staff completion requires the owner's access/UI approval, resolved applicable security findings, and verified deployment/migrations. Keep this work open even while the current simplified login is usable.

Order: preserve simple access for current review, complete the framework/dependency-security pass next, then return to this staff-completion sequence before launch. No security redesign is authorized by this documentation update alone.

### Pre-Framework Checkpoint (2026-10-31)

Approved scope: reconcile this list, execute real database/action regressions, rehearse restore without production writes, patch compatible native/PDF dependencies, and validate email behavior. No framework migration, staff-auth redesign, pricing change, hardware flashing, or phone installation.

- Added isolated in-memory tests using the schema-only D1 fixture through 0110 and migration 0111. They execute actual scheduling, creator, report, invite/profile/onboarding, and operational-email modules rather than relying only on source-text checks. Synthetic identities exist only in the test process, never in app routes or production.
- Found incorrect global slug uniqueness in `checklist_sections`, `list_sections`, and `documents`. Migration 0111 replaces it with per-business uniqueness while preserving all columns, IDs, child items, and file references. Rollback, same-name two-tenant creation, exhaustive tenant-table uniqueness review, and readiness-definition tests cover the correction. Deployment status must be recorded after execution below.
- Restored both ignored local/production exports in isolated SQLite, checked integrity/foreign keys, rehearsed migrations, and compared every preserved row. This does not complete Cloudflare-hosted disaster recovery, R2 object recovery, or deployment rollback.
- Email tests intercept Resend requests and cover tenant/department/consent recipients, direct invite/reset links, approval targeting, escaping, idempotency, failure/retry, and deliberate exclusion of temperature emails. The sender now has a 15-second timeout, refuses redirects, and requires a provider acceptance ID. Real inbox delivery remains unverified by these tests.
- Capacitor core/CLI/Android/iOS are pinned to 8.4.3; PDF.js is pinned to 6.4.299 with matching legacy renderer/worker for browser compatibility and the current canvas API. Compatible transitive patches stay within existing parent ranges. SvelteKit, Vite, Wrangler, TypeScript, Node, and adapters remain unchanged. Installed native apps require a rebuilt binary, not just a web deployment.
- Notification delivery is deferred by explicit user decision on 2026-10-31. No delivery ledger, push sender, SMS sender, related migration, or new retry pipeline was added. Existing registration/preferences remain; server-side APNs/FCM delivery and provider-level deduplication/retry handling need their own approved pass.
- Final audit: 11 full-tree affected packages (zero critical, four high, five moderate, two low); production-install tree has four moderate and zero high/critical. Remaining full-tree packages: `@capacitor/cli`, `glob`, `minimatch`, `rimraf`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`, `deepmerge`, `miniflare`, `sharp`, `vite`, and `wrangler`. Framework findings can affect deployed code despite npm's dev-dependency classification. No alert is suppressed; the remaining security gate stays open.
- Migration 0111 is applied locally and in production after fresh ignored `.db-backups/before-content-namespaces[-local]-20261031.sql` exports and offline rehearsal. Before/after exports confirm all existing rows in 111 application tables are identical, including identities, memberships, item rows, and file references; integrity/foreign keys pass and no staging tables remain. D1 migration bookkeeping is the only added record. No restaurant accounts, passwords, reservations, or device credentials changed.
- Validation passed: full `test:static` (zero type errors/warnings), web/native UI builds, Capacitor sync, actual workflow/PDF tests and final Cloudflare build on exact Node 22.13.0, clean Linux-targeted npm 10.9.2 installation (207 packages), local/production restore rehearsals, and Android `:app:assembleDebug` (92 tasks). No phone installation or firmware flashing. iOS compilation is still a macOS/Xcode gate; debug compilation does not prove store signing or device behavior.
- Dispatcher read-only schedule/deployment lookup returned Cloudflare 403 with the current API token. Its current cron/uptime remains unverified; no worker redeployment, secret change, or wider token permission was made. Verify in the dashboard with the owner before closing that integration gate.
- Release checkpoint `e53b10f` is pushed. The production PDF worker matches the Node 22.13.0 build byte-for-byte, production schema readiness passes, and all seven public smoke routes return 200. Live D1 foreign-key checks are clean.
- Authenticated production smoke PASSED on 2026-10-31 after the owner updated the local smoke credentials: successful session creation, all ten checked app routes, all five checked manager routes, all seven public routes, production schema readiness, forgot-password request, and confirmed session revocation on logout. No authentication code, account password, or security controls changed. The reset-request response does not prove inbox delivery; manual workflows, two-tenant data isolation, remaining security findings, and external integration gates remain open. This is route/session validation, not public-launch approval.

### Framework And Dependency Security

Framework migration started on 2026-10-31 after the authenticated production checkpoint passed. The compatible native/PDF pre-work is complete. No production deployment of the framework change is approved until the replacement passes validation; no database schema/workflow redesign, UI restyling, staff-auth redesign, firmware flashing, or phone installation belongs to this pass.

Migration inventory: 257 source files, 73 pages, and 163 route/layout files. Rewire 23 Cloudflare runtime-binding files and 47 platform-type consumers, 191 files using `$lib` imports, 36 environment imports, 10 legacy-store consumers, one service worker, 20 navigation consumers, and 29 enhanced-form pages. No route parameter matchers or remote-function modules exist to migrate. Preserve route IDs, SQL, tenant/permission/billing checks, session-cookie behavior, form errors, native HTTP/cookies/downloads, email dispatch, and sensor API contracts. Update the build/version pins, both adapters, type generation, and real SQL/Workers test loaders together. Source: https://svelte.dev/docs/kit/migrating-to-sveltekit-3.

Verified stable target set: SvelteKit 3.1.1, Cloudflare adapter 8.0.2, static adapter 4.0.1, Svelte 5.57.3, Vite 8.3.5/plugin 7.3.1, TypeScript 6.0.3, svelte-check 4.7.7, Wrangler 4.156.0, and Node 22.23.4. Do not use TypeScript 7 merely because it is the latest registry tag; Kit 3 and svelte-check currently require the 6.x peer range. Keep version polling explicitly disabled to preserve current polling behavior. Record actual validation/progress here rather than creating another checklist.

Local migration checkpoint (2026-11-01; not deployed):
- Configuration moved into `vite.config.ts`; the web build remains Cloudflare Pages and native output remains `mobile-dist`. Native compilation uses `.svelte-kit/native` so it cannot overwrite the web server files referenced by the new adapter. The native build now checks existing web artifact hashes and fails if they change; the preservation check passed.
- Cloudflare bindings and `waitUntil` use the supported runtime module; request handlers receive private bindings through server-only `locals.env`. Platform types, real module imports, removed stores/environment modules, form callback types, navigation options, and service-worker APIs are migrated. Legacy components use reactive state-to-store bridges to preserve existing behavior; no visual redesign or wholesale component rewrite.
- The service worker has its own TypeScript project and `check:worker` gate. Registration is module-based. Public/static-only caching remains; a missing offline fallback now returns the existing 503 response instead of an undefined response.
- All 163 route/layout paths, 950 SQL fragments across 147 existing TypeScript files, styles across 109 existing Svelte components, `src/app.css`, migration files, and firmware are unchanged. No tenant/account creation, password reset, schema migration, live device change, new notification delivery, or production write belongs to this pass.
- Passed: zero type errors/warnings, worker type checking, full static suite, real SQL/action/staff/email/PDF regressions, web/native builds and sync, Node 22.23.4 core-workflow/PDF/build checks, clean Linux-targeted npm 10.9.2 install, and Android debug compilation. The lockfile is checked for exact direct dependencies, required platform metadata, and absence of local filesystem links.
- The compiled local Cloudflare Worker passed schema readiness, public routes, anonymous app/staff denial, web/native form failures (400), and rejected cross-site mutations (403). An isolated headless browser verified hydration, same-page query reactivity, client navigation without reload, and staff login destinations. These checks do not use the production database, personal browser profile, phone, or firmware.
- Candidate audit: nine affected packages, zero critical/high, four moderate and five low. Remaining roots are the Capacitor CLI `rimraf -> glob -> minimatch` chain and Vite's `deepmerge` build-configuration chain; peer propagation also flags Kit/adapters. The production-install audit has four moderate packages because CLI is currently declared there. These are not nine independent application vulnerabilities, but they are not suppressed or declared fixed. No unsafe CLI downgrade or unverified major transitive override was applied; review disposition before release.
- Native/backend compatibility follow-up (2026-11-01): an isolated browser reproduced a Kit 3 packaged-client reload after a separately versioned backend returned a transient 503. The native fetch bridge now removes only `x-sveltekit-version` from rewritten backend responses; web/static/external requests and browser update checks are unchanged. Response bodies remain streamed, and status, headers, cookie behavior, request cancellation, URL/redirect metadata, and error/retry behavior are regression-tested by `test:native-transport`, included in `test:static`.
- The actual deployed Kit 2 client was rebuilt from `e53b10f` in an ignored directory. Both that client and the migrated packaged client passed local real-Worker data loading, same-page query reactivity, anonymous protected-route redirects, enhanced form failure deserialization/rendering, and simulated 503 recovery/retry. These isolated desktop-browser checks substitute only the native HTTP transport; they do not prove Capacitor OS cookie persistence, authenticated production workflows, or physical Android/iOS behavior. No account, phone installation, production data, or firmware was changed.
- Remaining dependency disposition (2026-11-01): registry checks found no patched compatible release for either root chain. Capacitor CLI calls `rimraf.sync` with local build paths and no glob/signal options; its glob/minimatch dependencies are not called with tenant input. The Svelte Vite plugin calls `deepmerge` on checked-in build configuration, not request or uploaded data. No imports or recognizable implementations from these roots were found in the emitted server/native JavaScript. This supports a build-tool-only exposure assessment for this app, not a claim that the packages are patched or risk-free. Keep all nine audit flags visible, use trusted build configuration/dependencies, and recheck upstream fixes before public release. Do not apply npm's suggested ancient CLI downgrade or force incompatible glob/minimatch majors. Sources: https://github.com/advisories/GHSA-3g3m-2fjr-6pw4, https://github.com/advisories/GHSA-g3hv-75wg-m249, https://github.com/advisories/GHSA-gcqx-w48m-w2h4.
- Final automated candidate checks passed again: full `test:static` including native transport, gateway Wi-Fi behavior, the pinned Node 22.23.4 transport test, exact-manifest/lock Linux-targeted npm 10.9.2 clean install (206 packages), web/native builds, Capacitor synchronization, final packaged-client browser checks, and Android `assembleDebug` (92 tasks). Scanning 1,416 generated text artifacts found no checked private local credential values; native HTML matches the final bundle and the temporary layout is absent. The normal `npm run dev` server also passed checked public/auth routes, app/staff login redirects, and actual browser hydration, same-component query updates, client navigation without reload, and staff-login form destinations. Cold Vite dependency optimization was allowed to finish and the browser harness waits for actual component mount, not just SSR markup. Temporary local test servers and browser profiles were closed/cleaned; no APK was installed or hardware flashed.
- Next: obtain the coordinated-release decision with the unresolved build-tool findings visible. Nothing in this framework pass is committed, pushed, or deployed yet. After approval, deploy the web candidate, rebuild native releases, and repeat authenticated production smoke and the Phone Validation Matrix on the matching release. iOS compilation still needs macOS/Xcode. Staff-security redesign, live HR/onboarding verification, two-tenant data tests, dispatcher proof, store integrations, and deferred push/SMS retain their separate open gates below.

Execution status (2026-11-01): steps 1-3 are complete locally; step 4 has a recorded upstream build-tool risk disposition with nine unresolved low/moderate package flags; step 5's available automated/local gates pass, but production/device/iOS and integration tests remain open. Step 6 is awaiting the release decision. Do not repeat completed migration work or mark the remaining launch gates complete.

1. Confirm the pre-framework checkpoint is validated and pushed, then retain its PDF/native regression tests. Real device networking/billing/push tests remain open; a website deployment alone does not repair an already installed app.
2. Inventory and migrate to stable SvelteKit 3 with compatible Cloudflare/static adapters, Node >=22.17, TypeScript 6, Svelte >=5.57.1, and compatible Vite/plugin versions. Move configuration from `svelte.config.js` to the Vite plugin, preserve separate web/native build outputs, and update Cloudflare build-version configuration deliberately. Official guide: https://svelte.dev/docs/kit/migrating-to-sveltekit-3.
3. Migrate Cloudflare environment/context access, hook/types, cookies, form actions/status handling, navigation/invalidation, aliases/env imports, and build/test harnesses as required by the guide. Preserve tenant authority, primary-password hashing, exact native-origin/CSRF checks, session semantics, store callbacks, and sensitive-data access. No redesign, feature changes, or data/schema restructuring by assumption.
4. Resolve the remaining dependency tree deliberately, including build tooling and the existing overrides. Use compatible patched versions, verify any necessary transitive API override with real tooling tests, retain complete cross-platform lock metadata, and test a clean Linux install with Cloudflare's npm version. Re-audit the full and production dependency trees. Any unpatched upstream finding needs a documented applicability/mitigation decision, not suppression or a claim of zero risk.
5. Run full type/build/regression tests, real Cloudflare-runtime checks, native packaging, and Android compilation without installing on the user's phone. iOS compilation requires macOS/Xcode. Revalidate login/logout/reset, invited/purchaser onboarding, staff password confirmation/roles, billing/store callbacks, tenant isolation, scheduling, lists/docs/PDF/uploads, reports, email/push, and sensor ingest/Wi-Fi setup; retain every existing manual test below. No physical hardware flashing.
6. Review the exact diff and deployment/migration needs, deploy only at the agreed checkpoint, and validate the same commit on Cloudflare plus rebuilt Android/iOS binaries. Keep public signup and billing/tenant gates intact. Do not resume real customer/SPPI rollout while critical/high findings remain unaddressed.

### Framework Release (2026-11-02)

- The owner approved pushing/deploying this migration and completing any required migration/connection work. This supersedes the local-only release hold above; it does not approve public signup, deferred notifications/pricing, staff-auth redesign, or hardware/phone changes.
- The complete static/type/build/action regression suite passed again before release. Source comparisons confirm unchanged route paths, SQL literals, component styles, firmware, migrations, base CSS, and native transport configuration. The native response-version compatibility fix and its regression remain part of this release.
- Production D1 migration listing reports no migrations to apply. No new SQL file is required for the framework change, and no production schema/data rewrite or credential change was performed.
- Existing Wrangler OAuth access confirms Pages uses `main`, `npm run build`, `.svelte-kit/cloudflare`, the expected `DB`/`DOC_MEDIA` bindings, and the required secret names. There is no `NODE_VERSION` dashboard override; the checked-in Node pin applies. The D1 token in `.dev.vars` has narrower permissions; do not replace it or widen permissions merely to read Pages metadata.
- Dispatcher metadata confirms its every-minute cron and `APP_BASE_URL`, `DB`, and `SMOKE_INTERNAL_TOKEN` bindings. This closes the earlier metadata-access uncertainty, not proof of successful scheduled execution or inbox delivery. The dispatcher source and service API paths are unchanged by this framework release.
- Final deployed application commit: `822c88d508250f3a56a9590587f16f692fec5033`, production Pages deployment `547a230b-4597-42cd-b018-03f87f9ce8db`. Every Cloudflare build/deploy stage succeeded. Production remains `https://criminiops.com`, with the production Pages alias also checked; `PUBLIC_SIGNUP_ENABLED=false`, `APP_BASE_URL`, expected bindings, and required secret names are confirmed in the deployed configuration. No database migration or secret replacement was needed.
- Initial framework commit `2f9fb93` built and deployed successfully on Cloudflare. Live schema readiness, login, all ten checked app routes, all five checked manager routes, and logout revocation passed. The live reset-email request exposed an existing Cloudflare incompatibility in the earlier email-hardening patch: Workers rejects `redirect: 'error'` before calling Resend. The sender now uses supported manual redirects and explicitly rejects 3xx responses, preserving credential-forwarding protection. Its regression also executes the real helper in workerd with the production compatibility settings and intercepted outbound requests; no new dependency or live test email is used by that local test. The smoke checker now requires a successful reset action, not merely a non-error HTTP status.
- Existing dispatcher logs show consecutive successful scheduled email calls and temperature-processing cycles against the migrated backend, with zero queued email events/active sensor businesses processed and no exceptions. This proves the observed cron/DB/token/processor connections, not long-term uptime, real alert behavior, or inbox delivery. Temporary log tails were stopped and raw request logs deleted; only redacted operational observations remain locally.
- Final authenticated smoke on `criminiops.com` passed: production schema readiness, seven public routes, valid sign-in, ten checked app routes, all five checked manager routes, a successful password-reset action, and verified logout session revocation. Reset success confirms provider acceptance through the real sender; receipt in the user's inbox remains a manual check. Passwords and account permissions were not changed. The Pages alias separately passed public routes and schema readiness without a second reset email.
- Additional live gates passed: web/server build-version alignment, trusted native-origin form failure (400), rejected cross-site mutation (403), and service-worker availability. The corrected complete static suite, actual workerd email regression on pinned Node 22.23.4, Linux-targeted npm 10.9.2 clean install (206 packages), native rebuild/sync, and Android debug build also passed. No phone installation or firmware flashing occurred; installed apps are not automatically replaced by a Git push.
- Current status: the framework rollout and its available automated/live release checks are complete for continued controlled testing. Keep the nine unresolved upstream low/moderate build-tool package findings visible; the candidate audit had no high/critical findings. Physical Android/iOS behavior, store integrations, multi-tenant/manual feature testing, HR/legal review, and deferred push/SMS are not completed by this release. Resume the approved Staff Completion sequence above, starting with its security/recovery design approval; do not restart the framework migration or infer permission for an authentication redesign.

### Launch Validation And Integrations

1. Cloudflare private validation setup
- Keep public signup closed, owner signup allowlisted, active-tenant invitation checks, and paid/test-tenant access gates intact. Do not reintroduce the removed marketing access-key gate.
- Confirm `DB`, `DOC_MEDIA`, `APP_BASE_URL`, `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `PASSWORD_PEPPER`, Resend secrets, billing secrets, and Turnstile secrets.
- Export D1 before loading real tenant data.
- Run `npm.cmd run schema:readiness:prod` and `npm.cmd run smoke:prod` against the exact deployment being tested.

2. Private multi-tenant validation
- Create at least two private validation businesses before entering the three real restaurants.
- Confirm tenant isolation across users, schedules, lists, docs, reports, uploads, devices, billing, and admin permissions.
- Fix any failed behavior before adding real restaurant data.

3. Email and operational events
- Verify real Resend inbox delivery for invites, onboarding, approvals, password reset, schedules, shifts, time off, lists, and billing. Temperature events deliberately do not send email.
- Process operational events and confirm recipients are correct, deduped, tenant scoped, and not exposed to unrelated users.

4. Native push notifications (deferred; separate approved pass)
- Implement the missing server-side APNs/FCM delivery path and agree on bounded, tenant-scoped retries/deduplication before configuring provider credentials. Token registration/preferences alone do not deliver notifications. No ledger implementation is approved in the current pass.
- SMS delivery is also unimplemented; provider consent/revocation/STOP/HELP handling needs its own completion before enabling texts.
- Test token registration, refresh, logout revoke, user preferences, and real event-triggered notifications on iOS and Android builds.

5. Temperature hardware
- Provision gateway and sensor-node serials into `iot_device_inventory`.
- Claim a gateway in `/admin/sensors`, assign sensor nodes, ingest gateway-authenticated readings, and confirm wrong tenant, wrong gateway, unassigned, and revoked readings are rejected.
- Gateway Wi-Fi setup uses a protected temporary gateway network and a local browser page, reachable from Registered Equipment on desktop or phone. The app guide is already pushed; physical provisioning and final wording/layout review remain open. Bluetooth provisioning plugins, dependencies, and permission prompts are removed.
- Physical provisioning checks remain open: claim by serial and confirm registration automatically opens and focuses that gateway's Wi-Fi guide on the same page; join the exact gateway setup network using its displayed setup password; select or enter restaurant Wi-Fi; test incorrect password, hidden SSID, interrupted setup, retry, gateway reboot, and router reboot; reconnect the computer/phone to normal Wi-Fi and require a new authenticated gateway check-in. Confirm no restaurant SSID/password enters D1, Cloudflare logs, audit metadata, or app storage.
- Verify recovery timing on real hardware: after 10 minutes of failed Wi-Fi joins the gateway pauses radio reception and offers setup. Existing credentials are preserved until Wi-Fi and the authenticated cloud check succeed. With a saved network, setup times out after 10 minutes and normal receive/retry resumes. While no user is attached, the setup loop also retries the saved network. Check multiple nearby gateways, restoration of the old router, and transition to a replacement router. Setup requires a Wi-Fi-capable computer or phone; the public site does not contact local addresses in the background.
- Confirm gateway-only check-in and Wi-Fi failure recovery with no registered nodes: the gateway checks in every five idle minutes when there is no recent successful upload. These status-only requests must not insert temperatures, refresh sensor timestamps, or affect other tenants.
- Tune thresholds by sensor type and verify high, low, stale, offline, recovery, dashboard, polling, and report behavior.
- Dispatcher deployment, `DB`/secret bindings, every-minute cron, and observed successful email/temperature scheduled calls are verified at the 2026-11-02 framework release. Continue long-duration uptime, real delivery, and sensor stale/offline tests; bounded temperature processing runs every five minutes. Empty successful batches do not validate real alerts or inbox delivery.
- Validate gateway outage recovery: retain only the latest transient reading per node, recover after Wi-Fi/API interruption, resume IEEE 802.15.4 receive mode, report gateway health while nodes are quiet, and complete a 24-hour bench soak plus a controlled network-outage test before restaurant deployment.
- Phase 5 hardware pass: `firmware/arduino/CriminiTempNode/` and `firmware/arduino/CriminiTempGateway/` are separate Arduino IDE sketches. The node sends three authenticated AHT20 temperature/humidity bursts with randomized spacing; the gateway adds RSSI/LQI and posts authenticated latest-reading batches. Real-board provisioning and recovery validation remain open; no hardware is flashed by source/build validation.
- Phase 5 remaining needs: flash real boards, validate battery draw, radio range, enclosure performance, final FCC/module compliance, and live sensor ingest under private tenant testing.

6. Scheduling validation
- Test owners, managers, department-scoped managers, shift leads, consultants, contractors, and staff.
- Confirm a manager draft survives navigation, reload, browser restart, template replacement, and prior-week copy without a manual save action.
- Confirm employees retain the last published schedule while managers edit, then receive exactly one updated version after publish or republish.
- Confirm two manager sessions cannot silently overwrite each other: stale saves and publishes must return the reload conflict instead of duplicating or losing shifts.
- Confirm department-scoped managers can edit only assigned departments and cannot publish an unauthorized full week.
- Confirm selected-day duplication affects only the chosen destination days and never future weeks.
- Confirm open shifts, offers, approvals, time off, availability, labor targets, role/department reference protection, My Schedule, dashboard shifts, history, notifications, and weekly exports remain synchronized with the published version.
- Confirm desktop and mobile time selection closes after commit/cancel and the schedule workspace remains clear of the footer at all grid sizes.

7. Lists, docs, menus, recipes, and tools
- Create, edit, delete, submit, upload, replace, attach, and export real data for checklists, prep lists, inventory, orders, docs, menus, recipes, ToDo, whiteboard, specials, announcements, spotlight, vendors, reminders, conversions, food cost, safety reference, and waste tracker.
- Confirm feature hiding, permissions, immediate UI updates, CSV safety, and tenant scoping.

8. Reports and exports
- Open reports as owner, manager, consultant, contractor, and staff.
- Confirm access rules, row limits, read-only behavior, spreadsheet-safe CSVs, sensitive onboarding exclusions, and tenant isolation.
- Confirm the Reports workspace exposes Prep, Checklist, Inventory, Orders, Waste, Schedule, Requests, Onboarding, Temperature, and permission-eligible ToDo history without showing links the active user cannot open.
- Confirm each native report applies its date range, summary totals, responsive table rows, empty state, and 100-row display cap without exposing another tenant or sensitive onboarding payloads.
- Compare each native report with its full-range CSV, including identical date filters, readable headers, formatted dates, temperature units, date-stamped filenames, mobile downloads, and data from a second tenant.

9. Invite, onboarding, and HR
- Test owner, manager, employee, consultant, and contractor invite flows.
- Test the complete employer onboarding workspace flow: create and revoke invitations, configure required forms and policies, upload and preview source forms, install missing standard forms, send a packet, follow in-progress status, review submitted forms and physical I-9 verification, return corrections, approve the packet, and confirm the final status and documents appear on the correct tenant-scoped employee record.
- Confirm employee/manager invite registration skips business pricing, creates correct onboarding packets, stores packet submissions, supports review/change/approval, and audits sensitive HR media access.
- Confirm invited employees receive the four-step light-theme flow (name/birthday, address, contact/login, welcome), retain completed fields after a validation error, and enter the exact inviting business.
- Confirm browser/native sign-in routes employees with an active packet to the non-blocking Profile & Settings onboarding prompt, while employees without a packet enter the dashboard normally.
- Confirm the welcome screen uses only configured store listing URLs, browser installation remains available, and secure packet access remains at `/onboarding`.
- Verify employee and purchaser notification consent begins unselected, requires separate Email and SMS Yes/No decisions, permits refusal without blocking registration, records the disclosure version/source/time and every later change, and immediately excludes revoked users from optional delivery. Before enabling SMS delivery, verify provider-level `STOP`/`HELP` handling and have qualified counsel approve the final consent language.
- Legal/payroll review is still required for I-9, W-4, state forms, contractor handling, retention, and employment documentation wording.

10. Authentication and account lifecycle
- Test login, logout, register, invite registration, forgot/reset password, workspace switching, account deletion, expired/reused invites, revoked sessions, revoked devices, inactive users, direct route probing, internal APIs, device APIs, and billing webhooks.
- Confirm rate limits, Turnstile behavior, same-origin mutation protection, audit logs, and stale cookie cleanup.

11. Billing and store subscriptions
- Create App Store Connect and Google Play products for `crimini.plan.small.monthly`, `crimini.plan.medium.monthly`, `crimini.plan.large.monthly`, and `crimini.addon.temps.monthly`.
- Test sandbox purchase, restore, cancel, refund, renewal, grace, hold, past-due, webhook reconciliation, tenant activation, and entitlement changes.
- Confirm Small is `$29/mo`, Medium `$49/mo`, and Large `$69/mo`; confirm temperature monitoring is `$17/mo` for up to 12 active sensors plus `$2/mo` for every active sensor above 12.
- Deferred until current tenant testing is complete: change Large to `$79/mo` and include temperature monitoring for up to 12 sensors; keep Small at `$29/mo` and Medium at `$49/mo`, with the `$17/mo` monitoring add-on for up to 12 sensors on those tiers.
- Deferred sensor checkout: cap standard self-service deployments at 25 sensors per location, charge `$2/mo` for each sensor above 12 through 25, and route requests above 25 to Crimini support for equipment, gateway-placement, and possible onsite review.
- Deferred store catalog: generate approved Apple and Google subscription variants for each plan/sensor-price combination, map the owner's plan and requested sensor count to one verified store product, show only the calculated selection and final monthly total in Crimini, and derive tenant entitlements from the verified receipt rather than client input.
- Deferred onboarding: ask whether monitoring is needed, collect 1-12 sensors, reveal a total-sensor field for 13-25 when requested, show hardware/installation separately, and block self-service checkout above 25 with the larger-deployment contact path.

12. Native app release
- Configure JDK/JAVA_HOME, Android signing, iOS/TestFlight, and Capacitor sync.
- Test login/session persistence, uploads, PDFs, push, billing bridge, external links, deep links, account deletion, and real-device behavior.
- Complete the ordered Phone Validation Matrix below on Android, then repeat it on iOS before store submission.

13. Store submissions
- Apple: app record, IAP products, screenshots, metadata, TestFlight build, privacy disclosures, review account, and review notes.
- Google Play: app record, subscriptions, Data Safety, content rating, screenshots, metadata, internal testing, review account, and review notes.

14. Cloudflare edge security and observability
- Enable Managed WAF, OWASP rules where available, auth-route rate limits/challenges, alerting, and log monitoring.
- Keep service endpoints token/device-auth protected instead of challenge-gated: billing webhooks, internal smoke/schema readiness, temperature ingest, temperature alert processing, and operational-event processing.
- Watch `schema_readiness_failed`, `tenant_access_denied`, `billing_conversion_failed`, `billing_cancel_failed`, repeated 500s, media denials, device auth failures, notification failures, and deployment failures.
- Isolated SQLite export/restore and row-preserving migration drills are covered at the pre-framework checkpoint. Still rehearse Cloudflare-hosted recovery, R2 object recovery, and rollback from a known-good deployment without modifying production data.

15. UI and accessibility final pass
- Walk app, admin, auth, onboarding, billing, schedule, reports, tools, docs, menus, and marketing in desktop/mobile and light/dark modes.
- Fix clipped footer/sidebar, contrast issues, verbose helper copy, old rounded-card styling, missing focus states, and broken responsive layouts.

16. Legal, public site, and business readiness
- Complete qualified review of privacy, terms, billing terms, support contact, account deletion, employee forms, trial/payment/cancellation wording, device monitoring, and retention language.
- Keep public customer launch/signup closed until trademark/LLC timing is safe; controlled testing on the already-online domain is allowed.
- Re-run production smoke on the exact release commit before public launch.

17. Launch candidate
- Freeze feature changes.
- Run the full validation suite.
- Complete the manual validation matrix.
- Push the final GitHub commit.
- Deploy the final Cloudflare build.
- Submit Apple and Google builds.
- Keep backup, incident, and rollback plans ready.

## Manual Validation Matrix

Run these with at least two private validation businesses before entering real restaurant data.

- Permissions: verify owner, manager, staff, consultant, contractor, permission templates, route access, feature hiding, and direct URL denial.
- Tenancy: create similar employee names, departments, schedules, list names, docs, menus, recipes, and reports in separate businesses and confirm nothing crosses tenants.
- Scheduling: test draft persistence, published/draft separation, direct publish and republish, concurrent-manager conflicts, scoped departments, duplicate day, templates, labor targets, open shifts, offers, time off, approvals, My Schedule, notifications, history, and exports.
- Manager dashboard: verify scoped time-off and availability approvals, approved availability in the builder, named temperature exceptions, announcement history/delete/retention, reminders, ToDo aging, whiteboard moderation, and Schedule & People links.
- Business & Systems: verify permission-aware navigation between Business Registry, Billing, Feature Matrix, and Temperature Sensor Setup; confirm App Editor stays under Content & Operations; test registry and branding edits, feature visibility, native purchase/restore/manage paths, collapsed workspace cancellation, equipment registration, Wi-Fi provisioning, revocation, automatic alert recovery, and alert-rule updates against the active tenant only.
- Lists and content: test checklist, prep, inventory, order lists, item attachments, recipes, SOPs, docs, menus, uploads, replacements, deletes, and CSV exports.
- HR: test invite links, onboarding packets, submissions, review/change/approval, sensitive media, audit logs, and restricted access.
- Employee registration: test all four invite steps on desktop/mobile, email and SMS preference storage, password reset-in-place behavior, profile hydration, welcome downloads, and Profile & Settings handoff.
- Billing: test native purchase, restore, cancellation, refund/revoke, renewal, grace, hold, past-due, webhook processing, and entitlement changes.
- Temperature: test serial claim, gateway ingest, thresholds, stale/offline processor, wrong-tenant rejection, dashboard, polling, and temperature CSVs.
- Reports: test schedule, requests, temperature, onboarding, waste, ToDo history, and all list reports by role, tenant, row/full-range export, date/version filter, row limit, mobile download, and spreadsheet safety.
- Auth/security: test bad credentials, rate limits, Turnstile, reset tokens, expired invites, revoked sessions, inactive users, account deletion, internal APIs, device APIs, and billing webhooks.
- UI/accessibility: test desktop/mobile, light/dark, keyboard focus, contrast, sidebar/footer spacing, upload states, empty states, and loading/error states.
- Native/store: test Android and iOS builds, PDFs/uploads, push, billing bridge, deep links, review accounts, and account deletion.

## Phone Validation Matrix

Run this sequence on a physical phone against the private production-test environment. Record failures against the matching launch phase rather than creating another checklist.

1. Authentication and session
- Test invalid and valid credentials, Turnstile when configured, logout, relaunch, session persistence, expired session handling, password reset, and switching away from an already signed-in account.

2. Navigation and feature visibility
- Open every visible sidebar route, confirm back navigation and external links, and verify role, feature-matrix, and subscription restrictions hide and deny the same features.

3. Creator and content administration
- Create categories, lists, recipes, documents, and menus; edit and delete them; confirm immediate UI refresh and persistence after relaunch.

4. Lists and service workflows
- Add, edit, delete, and complete checklist, prep, inventory, and order items; submit counts; open attached recipes/docs; and confirm history records the correct user and business.

5. Scheduling
- Build and autosave a draft, relaunch, confirm staff still see the prior published version, publish without manual draft save, duplicate selected days only, verify My Schedule and dashboard shifts, offer/take a shift, submit time off and availability, and approve as an authorized manager.

6. Employees and onboarding
- Invite each supported role; configure, upload, and preview employer forms; finish invite registration and required packet steps; return and resubmit a correction; approve the packet; review permissions; and verify restricted HR information is inaccessible to unauthorized users.

7. Uploads and reports
- Upload and replace PDFs/images, open them on-device, download each supported CSV/report, and confirm files contain only the active business's data.

8. Operational tools
- Exercise ToDo, whiteboard, specials, announcements, spotlight, vendors, reminders, conversions, food cost, safety reference, and waste submission/reporting.

9. Temperature monitoring
- Register a gateway and nodes by serial, complete the Registered Equipment Wi-Fi guide from a desktop browser and phone, assign names, view current temperature/humidity, test provisioning failure/retry plus stale/offline/recovery states and alerts, and confirm readings continue through app backgrounding and relaunch.

10. Tenant isolation
- Repeat representative user, schedule, list, document, report, and device actions in a second business and verify no names, records, files, notifications, or devices cross businesses.

11. Mobile resilience
- Test slow/offline transitions, interrupted submissions, app background/foreground, process restart, screen rotation/fold states where supported, duplicate taps, and retry behavior without duplicate records.

12. External integrations
- Validate email links, push notifications, PDF/file handling, store purchase/restore flows when configured, account deletion, support/privacy links, and deep links from outside the app.
