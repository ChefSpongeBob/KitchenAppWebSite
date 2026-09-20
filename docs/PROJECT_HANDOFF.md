# Crimini Project Handoff

Use this as the single source of truth for continuing Crimini without guessing or branching into scattered checklists.

## Project

- Repo path: `c:\Users\spong\Desktop\SoftwareKitchenNNS`
- GitHub: `https://github.com/ChefSpongeBob/KitchenAppWebSite`
- Live domain: `https://criminiops.com`
- Current hold: production/live-domain tenant testing waits for trademark confirmation.
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
- Camera media: `src/routes/api/camera/media/[...key]/+server.ts`

## Cloudflare

- Pages project: `criminikitchenappwebsite`
- Wrangler app name: `criminikitchenapp`
- D1 binding: `DB`
- D1 database: `crimini-production`
- R2 bindings: `DOC_MEDIA`, `CAMERA_MEDIA`
- R2 buckets: `crimini-doc-media`, `crimini-camera-media`
- Production base URL: `APP_BASE_URL=https://criminiops.com`
- Required secrets include `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `PASSWORD_PEPPER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_STORE_PRIVATE_KEY`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `BILLING_WEBHOOK_TOKEN`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`.
- Private testing lock: keep marketing public, set `PUBLIC_SIGNUP_ENABLED=false`, and set `OWNER_SIGNUP_ALLOWLIST` to comma-separated owner test emails. Public tenant creation stays closed unless explicitly enabled or allowlisted; invited users can still register through valid active-tenant invites.
- Login Turnstile is enabled automatically when both Turnstile secrets are present; local/dev remains open when they are absent.
- Cloudflare edge security before public launch: enable Managed WAF rules, OWASP managed rules where available, and rate limits/challenges for `/login`, `/register`, `/forgot-password`, `/account-deletion`, and public API abuse paths. Do not challenge token/device-auth service paths: billing webhooks, smoke/schema readiness, temperature ingest, camera ingest, and operational-event processing.
- Browser hardening is split by response type: dynamic app responses are handled in `src/hooks.server.ts`; static/edge responses are covered by root `_headers`.

## Validation Gates

Run local/static gates before pushes or large changes:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run mobile:check
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
npm.cmd run test:camera-shelving
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

Live gates wait until the trademark/domain hold is lifted:

```powershell
npm.cmd run schema:readiness:prod
npm.cmd run smoke:prod
```

Equivalent package script names include `npm run test:cloudflare-readiness`, `npm run test:production-schema`, and `npm run schema:readiness:prod`.
Remote migration commands must use the active DB binding, for example `d1 execute DB --remote`.
Before production migrations, Create/confirm backup before migrations.

## Current Verified Areas

- Tenant authority checks pass; app role is derived from business membership.
- Tenant isolation checks pass for camera, temps, announcements, and spotlight paths.
- IoT device auth uses per-device credentials, not shared API keys.
- Media access is private, business-scoped, and no-store.
- Production schema guard blocks runtime mutation in production.
- Scale/performance static checks pass.
- Auth abuse checks pass. Login attempts are rate-limited. Audit logs store hashed email/IP/user-agent values where appropriate.
- Billing lifecycle checks pass. Trial identity claims prevent free-trial reuse, and cancellation creates a pre-purge snapshot.
- Store release checks pass for current code wiring.
- Cloudflare readiness checks pass against current config.
- Security headers and observability checks pass.
- Temperature hardware model now targets ESP32-C6FH4 AHT20/BMP280 sensor nodes that send short raw IEEE 802.15.4 star-network bursts to a claimed gateway; only the gateway authenticates to Cloudflare, customer setup is serial-based, humidity is stored with readings, and pressure is ignored.

## Store Billing

- Native app id / bundle id: `com.nexusnorthsystems.crimini`.
- Store products must be created in App Store Connect and Google Play before sandbox tests.
- Product IDs currently expected by the launch app/store plan include `crimini.plan.small.monthly`, `crimini.plan.medium.monthly`, and `crimini.plan.large.monthly`. Temperature monitoring is included with Medium and Large, not sold as a standalone Small add-on. Camera monitoring products are deferred post-launch.
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

- Last full static validation: 2026-06-19 after login Turnstile hardening and malicious-user hardening checks.
- Current repository status: app code is ready for controlled multi-tenant test data entry, not public production launch.
- Current hold: public production launch and live-domain customer onboarding still wait for trademark/LLC timing, final legal/payroll review, store setup, and live operational integrations.
- Phase status: Phases 1-18 and code-readiness parts of 20-22 are locally validated by scripts. Store, native-device, legal, live-domain, hardware, and edge-dashboard items remain manual/external.
- Camera shelving remains complete locally: camera UI is hidden, camera purchase paths are blocked, marketing treats cameras as planned expansion, and beta-gated camera routes stay unavailable unless explicitly enabled.
- Launch pricing remains aligned: Small `$30/mo`, Medium `$65/mo`, Large `$90/mo`, with temperature monitoring included only with Medium and Large.
- Turnstile login hardening is wired: login challenge appears only when `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are present, and server validation is fail-closed when configured.
- The only project completion/checklist file is this handoff. Do not create scattered task lists.

## Pre-Restaurant Data Entry Gate

Before entering information for three real restaurants, complete this gate in order:

1. Run local/static validation: `npm.cmd run test:static`.
2. Confirm repo is pushed and Cloudflare deployment passed for the same commit you intend to test.
3. Enable private signup protection on the target environment with `PUBLIC_SIGNUP_ENABLED=false` and `OWNER_SIGNUP_ALLOWLIST` set to approved owner test emails.
4. Confirm Cloudflare bindings/secrets on the target environment: `DB`, `DOC_MEDIA`, `CAMERA_MEDIA`, `APP_BASE_URL`, `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `PASSWORD_PEPPER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, `BILLING_WEBHOOK_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `PUBLIC_SIGNUP_ENABLED`, and `OWNER_SIGNUP_ALLOWLIST`.
5. Create or confirm a D1 backup/export before loading real tenant data.
6. Run production schema readiness against the exact Pages environment being tested: `npm.cmd run schema:readiness:prod`.
7. Run production smoke against the exact Pages environment being tested: `npm.cmd run smoke:prod`.
8. Create at least two private validation businesses first and run the Manual Validation Matrix below against controlled validation data.
9. Only after private validation tenants pass, create the three restaurant tenants and enter real restaurant information.

If any gate item fails, stop real data entry and fix/debug before continuing.

## Validated Code Areas

These areas are validated by current scripts/builds and do not have known code blockers before controlled multi-tenant testing:

- Authorization, roles, business membership, capability gates, direct-route denial, and tenant context.
- Session lifecycle, login/logout, reset-password plumbing, account deletion request persistence, rate limits, same-origin mutation guard, security headers, Turnstile login validation, and malicious-user regression checks.
- Creator Studio as the single editor surface for categories, lists, recipes, documents, menus, and item attachments.
- Core app feature actions for lists, docs, menus, recipes, ToDo, whiteboard, specials, announcements, spotlight, vendors, reminders, tools, business registry, and waste tracking.
- Lists/history/report foundation, including checklist/prep/inventory/order list domains, item attachments, CSV hardening, and tenant-scoped report routes.
- Scheduling code foundation: departments, roles, availability, time off, templates, autosave drafts, publish, open shifts, offers, approvals, My Schedule, and bounded schedule/report queries.
- Employee invite/onboarding/HR code foundation: invite role paths, packet requirements, sensitive vault encryption, HR-sensitive permission checks, audited reads, onboarding reports, and private media.
- Email code foundation: branded transactional helper, Resend integration, invite/approval/password reset/onboarding/operational email event wiring, idempotency, and delivery failure logging.
- Native push foundation: Capacitor plugin, token storage/revoke endpoints, user preferences, and native client registration plumbing.
- Temperature monitoring code foundation: gateway/node serial model, device auth, tenant-scoped temperature/humidity ingest, packet sequence/nonce/LQI diagnostics, thresholds, alert events, stale processor endpoint, acknowledgements, history/report wiring, and bounded ingest.
- Billing/store lifecycle code foundation: native purchase submission, pending entitlements, Apple/Google verification paths, token-gated webhooks, entitlement reconciliation, launch pricing, and deferred camera products.
- Camera shelving: launch navigation and purchase paths hide cameras; backend remains beta-gated for post-launch work.
- Cloudflare readiness: Pages config, D1/R2 bindings, schema guard, Node version, package lock, no old copied-app Cloudflare bindings, and deploy readiness checks.
- UI/readiness guards: current Crimini UI requirements, accessibility/focus checks, legal/support/public routes, Apple/Google readiness checks, and production build.

## Remaining Launch Work

This is the only active completion list. Work it in order and do not create scattered task lists.

1. Cloudflare private validation setup
- Enable private test protection on the target Pages environment.
- Confirm `DB`, `DOC_MEDIA`, `CAMERA_MEDIA`, `APP_BASE_URL`, `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `PASSWORD_PEPPER`, Resend secrets, billing secrets, and Turnstile secrets.
- Export D1 before loading real tenant data.
- Run `npm.cmd run schema:readiness:prod` and `npm.cmd run smoke:prod` against the exact deployment being tested.

2. Private multi-tenant validation
- Create at least two private validation businesses before entering the three real restaurants.
- Confirm tenant isolation across users, schedules, lists, docs, reports, uploads, devices, billing, and admin permissions.
- Fix any failed behavior before adding real restaurant data.

3. Email and operational events
- Verify Resend delivery for invites, onboarding, approvals, password reset, schedules, shifts, time off, lists, billing, and temperature alerts.
- Process operational events and confirm recipients are correct, deduped, tenant scoped, and not exposed to unrelated users.

4. Native push notifications
- Configure APNs and FCM credentials.
- Test token registration, refresh, logout revoke, user preferences, and real event-triggered notifications on iOS and Android builds.

5. Temperature hardware
- Provision gateway and sensor-node serials into `iot_device_inventory`.
- Claim a gateway in `/admin/sensors`, assign sensor nodes, ingest gateway-authenticated readings, and confirm wrong tenant, wrong gateway, unassigned, and revoked readings are rejected.
- Tune thresholds by sensor type and verify high, low, stale, offline, recovery, dashboard, polling, and report behavior.
- Phase 5 hardware pass: `firmware/arduino/CriminiTemperature/` contains the Arduino IDE node and gateway roles for raw IEEE 802.15.4. The node sends AHT20 temperature/humidity, packet sequence, wake nonce, and optional battery data; the gateway adds RSSI/LQI and posts authenticated batches. Both roles compile with the installed ESP32 Arduino core 3.3.10; real-board validation remains open.
- Phase 5 remaining needs: flash real boards, validate battery draw, radio range, enclosure performance, final FCC/module compliance, and live sensor ingest under private tenant testing.

6. Scheduling validation
- Test owners, managers, department-scoped managers, shift leads, consultants, contractors, and staff.
- Confirm schedule builder, autosave drafts, publish with unsaved changes, templates, labor targets, open shifts, shift offers, time off, approvals, My Schedule, event delivery, and report history.

7. Lists, docs, menus, recipes, and tools
- Create, edit, delete, submit, upload, replace, attach, and export real data for checklists, prep lists, inventory, orders, docs, menus, recipes, ToDo, whiteboard, specials, announcements, spotlight, vendors, reminders, conversions, food cost, safety reference, and waste tracker.
- Confirm feature hiding, permissions, immediate UI updates, CSV safety, and tenant scoping.

8. Reports and exports
- Open reports as owner, manager, consultant, contractor, and staff.
- Confirm access rules, row limits, read-only behavior, spreadsheet-safe CSVs, sensitive onboarding exclusions, and tenant isolation.

9. Invite, onboarding, and HR
- Test owner, manager, employee, consultant, and contractor invite flows.
- Confirm employee/manager invite registration skips business pricing, creates correct onboarding packets, stores packet submissions, supports review/change/approval, and audits sensitive HR media access.
- Legal/payroll review is still required for I-9, W-4, state forms, contractor handling, retention, and employment documentation wording.

10. Authentication and account lifecycle
- Test login, logout, register, invite registration, forgot/reset password, workspace switching, account deletion, expired/reused invites, revoked sessions, revoked devices, inactive users, direct route probing, internal APIs, device APIs, and billing webhooks.
- Confirm rate limits, Turnstile behavior, same-origin mutation protection, audit logs, and stale cookie cleanup.

11. Billing and store subscriptions
- Create App Store Connect and Google Play products for `crimini.plan.small.monthly`, `crimini.plan.medium.monthly`, and `crimini.plan.large.monthly`.
- Test sandbox purchase, restore, cancel, refund, renewal, grace, hold, past-due, webhook reconciliation, tenant activation, and entitlement changes.
- Confirm Small is `$30/mo`, Medium `$65/mo`, Large `$90/mo`, and temperature monitoring is Medium/Large only.

12. Native app release
- Configure JDK/JAVA_HOME, Android signing, iOS/TestFlight, and Capacitor sync.
- Test login/session persistence, uploads, PDFs, push, billing bridge, external links, deep links, account deletion, and real-device behavior.

13. Store submissions
- Apple: app record, IAP products, screenshots, metadata, TestFlight build, privacy disclosures, review account, and review notes.
- Google Play: app record, subscriptions, Data Safety, content rating, screenshots, metadata, internal testing, review account, and review notes.

14. Cloudflare edge security and observability
- Enable Managed WAF, OWASP rules where available, auth-route rate limits/challenges, alerting, and log monitoring.
- Keep service endpoints token/device-auth protected instead of challenge-gated: billing webhooks, internal smoke/schema readiness, temperature ingest, camera ingest, and operational-event processing.
- Watch `schema_readiness_failed`, `tenant_access_denied`, `billing_conversion_failed`, `billing_cancel_failed`, repeated 500s, media denials, device auth failures, notification failures, and deployment failures.
- Run one D1 export/restore drill in a non-production target and one rollback drill from a known-good deployment.

15. UI and accessibility final pass
- Walk app, admin, auth, onboarding, billing, schedule, reports, tools, docs, menus, and marketing in desktop/mobile and light/dark modes.
- Fix clipped footer/sidebar, contrast issues, verbose helper copy, old rounded-card styling, missing focus states, and broken responsive layouts.

16. Legal, public site, and business readiness
- Complete qualified review of privacy, terms, billing terms, support contact, account deletion, employee forms, trial/payment/cancellation wording, device monitoring, and retention language.
- Keep `criminiops.com` offline until trademark/LLC timing is safe.
- Re-run production smoke after the domain is attached for public launch.

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
- Scheduling: test draft save, publish, edits, duplicate day, templates, labor targets, open shifts, offers, time off, approvals, My Schedule, notifications, and exports.
- Lists and content: test checklist, prep, inventory, order lists, item attachments, recipes, SOPs, docs, menus, uploads, replacements, deletes, and CSV exports.
- HR: test invite links, onboarding packets, submissions, review/change/approval, sensitive media, audit logs, and restricted access.
- Billing: test native purchase, restore, cancellation, refund/revoke, renewal, grace, hold, past-due, webhook processing, and entitlement changes.
- Temperature: test serial claim, gateway ingest, thresholds, stale/offline processor, wrong-tenant rejection, dashboard, polling, and temperature CSVs.
- Reports: test schedule, requests, temperature, onboarding, waste, and list reports by role, tenant, row limit, and spreadsheet safety.
- Auth/security: test bad credentials, rate limits, Turnstile, reset tokens, expired invites, revoked sessions, inactive users, account deletion, internal APIs, device APIs, and billing webhooks.
- UI/accessibility: test desktop/mobile, light/dark, keyboard focus, contrast, sidebar/footer spacing, upload states, empty states, and loading/error states.
- Native/store: test Android and iOS builds, PDFs/uploads, push, billing bridge, deep links, review accounts, and account deletion.
