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
- Every feature must be real: no fake routes, hardcoded data, or UI-only plumbing.

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
- Required secrets include `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_STORE_PRIVATE_KEY`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `BILLING_WEBHOOK_TOKEN`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY`.
- Optional private testing gate: set `PRIVATE_TEST_GATE_ENABLED=true` and `PRIVATE_TEST_ACCESS_CODE` on the private Pages environment while the public site is withheld. Remove or set `PRIVATE_TEST_GATE_ENABLED=false` before public launch.
- Login Turnstile is enabled automatically when both Turnstile secrets are present; local/dev remains open when they are absent.
- Cloudflare edge security before public launch: enable Managed WAF rules, OWASP managed rules where available, and rate limits/challenges for `/login`, `/register`, `/forgot-password`, `/account-deletion`, and public API abuse paths. Keep billing webhooks, smoke/schema readiness, temperature ingest, and camera ingest token/device-auth protected at the app layer.

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
- Temperature hardware model now targets ESP32-C6 sensor nodes that radio to a claimed gateway; only the gateway authenticates to Cloudflare, and customer setup is serial-based.

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
3. Enable private test protection on the target environment with `PRIVATE_TEST_GATE_ENABLED=true` and `PRIVATE_TEST_ACCESS_CODE`, then verify `/test-access` gates the Pages URL.
4. Confirm Cloudflare bindings/secrets on the target environment: `DB`, `DOC_MEDIA`, `CAMERA_MEDIA`, `APP_BASE_URL`, `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, `BILLING_WEBHOOK_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `PRIVATE_TEST_GATE_ENABLED`, and `PRIVATE_TEST_ACCESS_CODE`.
5. Create or confirm a D1 backup/export before loading real tenant data.
6. Run production schema readiness against the exact Pages environment being tested: `npm.cmd run schema:readiness:prod`.
7. Run production smoke against the exact Pages environment being tested: `npm.cmd run smoke:prod`.
8. Create at least two fake businesses first and run the Final Multi-Tenant Test Notes below against fake data.
9. Only after fake tenants pass, create the three restaurant tenants and enter real restaurant information.

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
- Temperature monitoring code foundation: gateway/node serial model, device auth, tenant-scoped ingest, thresholds, alert events, stale processor endpoint, acknowledgements, history/report wiring, and bounded ingest.
- Billing/store lifecycle code foundation: native purchase submission, pending entitlements, Apple/Google verification paths, token-gated webhooks, entitlement reconciliation, launch pricing, and deferred camera products.
- Camera shelving: launch navigation and purchase paths hide cameras; backend remains beta-gated for post-launch work.
- Cloudflare readiness: Pages config, D1/R2 bindings, schema guard, Node version, package lock, no old copied-app Cloudflare bindings, and deploy readiness checks.
- UI/readiness guards: current Crimini UI requirements, accessibility/focus checks, legal/support/public routes, Apple/Google readiness checks, and production build.

## Pending Manual Or External Items

These are not code blockers found by the current static suite, but they must be completed or tested before public launch:

- Cloudflare dashboard: enable the private test gate secrets while testing, then enable Managed WAF rules, OWASP managed rules where available, auth-route rate limits/challenges, Turnstile widget keys, alerting, and log monitoring.
- Resend: verify live invite, approval, password reset, employee onboarding, schedule, shift, time-off, list, billing, and temperature emails against the production sender.
- Push notifications: configure APNs/FCM credentials and test delivery on real iOS/Android builds.
- Store billing: create App Store Connect and Google Play products, configure sandbox testers, test purchase/restore/cancel/refund/renewal/grace/past-due flows on real native builds.
- Temperature hardware: provision gateway and node serials, run real ESP32-C6 gateway/node ingest, tune sensor thresholds, and verify sustained live polling on Cloudflare.
- Legal/payroll: qualified review of privacy, terms, billing terms, account deletion, employee onboarding forms, I-9/W-4/state form handling, trial/payment wording, device monitoring language, and retention language.
- Native release: configure Android signing/JDK and iOS/TestFlight builds, then test login/session persistence, uploads, PDFs, push, billing bridge, deep links, and account deletion on devices.
- Production domain: keep `criminiops.com` offline until trademark/LLC timing is safe, then re-run production smoke after attaching the domain.

## Code/Debugging Queue Before Three Real Restaurants

Current status: no known code blocker was found by the completion-list audit. The next code/debugging work should be driven by failed validation from the fake-tenant test gate.

If the fake-tenant gate exposes failures, fix them before adding real restaurant data, especially in these high-risk areas:

- Cross-tenant data isolation between businesses with similar employee names, departments, list names, and schedules.
- Invite/onboarding flows for owner, manager, employee, consultant, and contractor accounts.
- Schedule autosave/publish, My Schedule visibility, shift offers, time-off approvals, department-scoped managers, and report history.
- Lists/docs/menus/recipes uploads, item attachments, delete/replace flows, CSV exports, and feature hiding.
- Permission-specific access to admin, reports, vendors, HR-sensitive data, billing, device setup, and creator actions.
- Live email delivery and operational event processing.
- Temperature gateway/node serial claim and ingest rejection paths.

## Final Multi-Tenant Test Notes

- Employee permissions pass: in `/admin/users`, search by name, email, department, role, and permission template; open an employee through `Permissions`; change account type, permission template, capability checkboxes, department access, and delete only in test tenants. Repeat as owner, manager, staff, consultant, and contractor. Confirm staff cannot directly open admin, reports, vendor, HR-sensitive, billing, device setup, or permission routes.
- Session cleanup note: employee login sessions are security plumbing, not normal staff-management UI. Revoke-session behavior should be tested later through account/security lifecycle tests, not the visible staff manager page.
- Phase 5 temp pass: register gateway/sensor serials, ingest valid readings, trigger high/low/stale/offline/recovery states, acknowledge alerts, verify wrong-business/wrong-serial/revoked-device rejection, and confirm dashboard/temp pages stay tenant scoped.
- Phase 5 hardware pass: pre-provision gateway and sensor-node serials in `iot_device_inventory`; claim one gateway in `/admin/sensors`; assign multiple sensor nodes to that gateway; send gateway-authenticated readings using node serials; confirm unassigned, wrong-gateway, wrong-business, and revoked node readings are rejected.
- Phase 6 schedule pass: create two businesses with separate employees; set owner, general manager, FOH manager, BOH manager, hourly manager, shift lead, consultant, contractor, and staff permissions; confirm each role/template/individual override sees only the correct schedule tools. Test department-scoped managers against FOH-only and BOH-only employees, including schedule builder visibility, shift creation, publish, approvals, templates, labor targets, and open shifts.
- Phase 6 schedule save/publish pass: add shifts, edit shifts, delete shifts, duplicate a day, navigate away and back to confirm autosaved draft data remains, publish with unsaved changes, confirm publish creates the final schedule, and verify schedule publish history/report exports still show the published week.
- Phase 6 employee schedule pass: log in as staff and verify `/schedule` and `/my-schedule` only show published shifts for that business/user; create availability, time-off requests, open-shift requests, shift offers, targeted shift offers, approvals, declines, withdrawals, and manager decisions. Confirm every action is tenant scoped and unavailable to unrelated businesses.
- Phase 6 notification pass: process operational events after schedule publish, shift offer, shift request, open-shift request, approval, decline, and time-off decisions; confirm emails route to opted-in users, managers, affected employees, and eligible department employees only.
- Phase 6 schema pass: in two businesses, create matching schedule departments and matching role names, assign availability and department approvals to similarly named employees, then confirm each business saves independently and no department, role, availability, template, or schedule change appears in the other business.
- Phase 7 list pass: create checklist, prep, inventory, and order lists; add/edit/delete items; attach recipes and SOPs; submit counts/completions; verify new items appear immediately; confirm saved inputs clear after save; confirm deleted lists/items disappear everywhere they should.
- Phase 7 history/alert pass: submit prep and checklist data as multiple employees; verify submitter and executor fields; confirm two-week prep history, checklist history, CSV/export behavior, completion alerts, item-completed events, and tenant isolation across two businesses.
- Phase 7 report URL pass: verify `/reports/lists?domain=preplists`, `/reports/lists?domain=inventory`, `/reports/lists?domain=orders`, and `/reports/lists?domain=checklists`; download each matching CSV and confirm date, list, item, action/value, completed-by, and submitted-by fields.
- Phase 7 event delivery pass: after list submission, item completion, and full-list completion, run the operational event processor; confirm opted-in manager/content-access users receive the correct alerts and unrelated business users receive nothing.
- Phase 7 permission pass: as owner, manager, shift lead, consultant, contractor, and staff, confirm list par controls and item attachment editor actions are available only to users with `manage_content`, while normal staff can still submit counts and complete checklist/list items.
- Phase 8 reports pass: open `/reports`, `/reports/schedule`, `/reports/requests`, `/reports/temperature`, `/reports/onboarding`, and all list report domains as owner, manager, consultant, contractor, and staff. Confirm permitted roles are read-only, staff is blocked, each route stays inside the active business, and CSV exports match the visible rows.
- Phase 8 CSV pass: download schedule, requests, temperature, onboarding, prep, inventory, order, and checklist CSVs with real data; open in spreadsheet software; confirm no sensitive onboarding form payloads, document URLs, password/session data, or cross-business rows appear.
- Phase 8 CSV safety pass: enter/export values beginning with `=`, `+`, `-`, `@`, tab, and carriage return; confirm downloaded CSVs open in spreadsheet tools as text values and do not execute formulas.
- Phase 9 billing pass: create matching Apple and Google sandbox products; purchase starter, growth, and enterprise from native builds; restore purchases; confirm entitlements activate the correct business only; confirm Medium/Large enable temperature monitoring and Small does not; cancel auto-renew without early lockout; test renewal, grace, hold/past-due, refund/revoke, and expiration notifications; confirm webhook rows become processed/failed/ignored and billing status updates match store state. Camera add-ons are deferred post-launch.
- Phase 9 pricing pass: confirm `/pricing`, `/register`, `/billing`, `/api/billing/products`, Apple sandbox products, and Google Play sandbox products all reflect Small `$30/mo`, Medium `$65/mo`, Large `$90/mo`, with temperature monitoring included only on Medium and Large. Confirm standalone temperature and camera products are unavailable during launch.
- Tools pass: open sidebar Tools and confirm Conversions, Food Cost Calculator, Safety & HealthCode, and Waste Tracker are visible to staff by default. Submit waste as staff, then confirm Waste Logs appears only in Reports for report-access roles and downloads tenant-scoped CSV rows.
- Phase 10 invite/onboarding pass: from `/admin/onboarding`, create owner, manager, employee, consultant, and contractor invites; open the email link into `/register?invite=...`; confirm employee and manager registration skips business/pricing controls and creates required packet forms, owner registration skips required employee packet forms unless sent manually, contractor registration does not create employee tax packets, and each flow lands at `/login`; log in and complete packet items from `/settings`; review, request changes, approve, and view source forms from `/admin/users/[id]` and `/admin/onboarding`; confirm staff cannot open HR-sensitive media or admin review routes; confirm owner/manager HR-sensitive access is audited and business scoped.
- Phase 10 route pass: test `/admin/onboarding`, `/register?invite=VALID_CODE`, `/register?invite=OWNER_CODE`, `/register?invite=CONTRACTOR_CODE`, `/register/welcome`, `/login`, `/settings`, `/admin/users/[id]`, `/reports/onboarding`, and onboarding media links. Confirm invite emails use onboarding copy only when packet forms are required.
- Phase 11 creator consolidation pass: open `/admin/creator` and each editor mode for category, list, recipe, document, menu, and item attachments; confirm old admin editor links redirect to the matching Creator Studio mode; toggle lists, recipes, documents, and menus off in App Editor and confirm the matching `/admin/creator?editor=...` mode is blocked or hidden while unrelated creator modes still work.
- Phase 12 core action pass: create, edit, delete, and view real data for lists, docs, menus, recipes, ToDo, whiteboard, specials, announcements, spotlight, vendors, reminders, conversions, food cost, safety reference, waste tracker, waste report export, and business registry inside two test businesses. Confirm each action saves, updates the visible page immediately, stays tenant scoped, respects permissions/feature flags, and has no stale hardcoded rows.
- Phase 13 camera shelving pass: with camera beta disabled, confirm `/admin/camera`, `/admin/camera/setup`, camera media/API paths, signup, billing, product API, native purchase, pricing, admin menus, and sidebar navigation keep cameras unavailable for launch while preserving backend code for post-launch work.
- Phase 14 auth lifecycle pass: test `/login`, `/logout`, `/register`, `/register?invite=...`, `/forgot-password`, `/reset-password/[token]`, `/workspace/switch`, `/account-deletion`, private app routes, direct admin route attempts, disabled features, expired/revoked sessions, revoked devices, inactive users, internal APIs, device ingest APIs, and billing webhooks. Confirm stale active-business cookies do not survive logout or session rejection.
- Phase 15 Cloudflare pass: before production migrations, create a D1 export backup into ignored `.db-backups/`; run local and remote migration checks; run `schema:readiness:prod`; confirm Pages project, domain, D1, R2, production secret names, and preview secret separation. Do not delete account-level legacy Cloudflare resources unless explicitly approved.
- Phase 16 live scale pass: after the public hold is lifted, test sustained schedule building, report export downloads, list submissions, temp ingest, temp polling, concurrent tenants, and user switching on Cloudflare. Confirm no excessive polling, no full media/document payloads in listing routes, no unbounded cleanup writes, no cross-tenant data, and no worker resource warnings under normal usage.
- Phase 17 incident/security pass: in Cloudflare, configure notifications or log monitoring for `schema_readiness_failed`, `tenant_access_denied`, `billing_conversion_failed`, `billing_cancel_failed`, media access denials, device auth failures, temperature alert failures, notification delivery failures, repeated 500s, and deployment failures. Run one D1 export/restore drill in a non-production target and one rollback drill from a known-good deployment before public launch.
- Phase 18 UI/accessibility pass: manually walk app, admin, auth, onboarding, billing, schedule, reports, tools, docs, menus, and marketing routes in light/dark mode and mobile/desktop. Confirm no legacy page-header subtitles, old rounded floating-card styling, low-contrast controls, clipped footer/sidebar layouts, missing focus states, or verbose helper copy remain.
- Phase 19 native release pass: after JDK/JAVA_HOME and Android signing values are configured, run `npm.cmd run native:prereq`, `npm.cmd run android:release:check`, `npm.cmd run build`, `npm.cmd run cap:sync`, Android release build, and iOS archive/TestFlight build. Confirm login/session persistence, store billing bridge, push opt-in/token refresh, external links, PDFs, uploaded menus/docs, and account deletion on real devices.
- Phase 20 Apple pass: create the App Store Connect app record for `com.nexusnorthsystems.crimini`; add subscription products `crimini.plan.small.monthly`, `crimini.plan.medium.monthly`, and `crimini.plan.large.monthly`; set privacy policy URL `/privacy`, support URL `/support`, and account deletion URL `/account-deletion`; upload screenshots and metadata; provide a full demo account and review notes; upload TestFlight build; test purchase, restore, cancellation, renewal, refund/revoke, login/session persistence, PDFs/uploads, push opt-in, and account deletion on real iOS.
- Phase 21 Google Play pass: create the Play Console app record for `com.nexusnorthsystems.crimini`; add subscription products `crimini.plan.small.monthly`, `crimini.plan.medium.monthly`, and `crimini.plan.large.monthly`; set privacy policy URL `/privacy`, support URL `/support`, and account deletion URL `/account-deletion`; complete App Content, Data safety, target audience, ads, content rating, and sign-in details; upload screenshots and metadata; provide a full demo account and review notes; upload an Android App Bundle to internal testing; test purchase, restore, cancellation, renewal, refund/revoke, login/session persistence, PDFs/uploads, push opt-in, and account deletion on real Android.
- Phase 22 legal/business pass: before public launch, have qualified legal/payroll guidance review `/privacy`, `/terms`, `/billing-terms`, `/account-deletion`, employee onboarding forms, I-9/W-4/state form flow, trial/billing wording, cancellation/refund wording, device monitoring language, and data retention language. Activate `support@criminiops.com` receiving/forwarding, confirm store Data safety/privacy answers match actual app behavior, and keep the public site offline until trademark/LLC timing is safe.

## Launch Completion List

This is the only active completion checklist. Work it in order and do not create additional scattered task lists. Next Phase List refers to this launch completion list.

Status legend:

- `Validated`: local code, schema, route, and static guards pass.
- `Manual Gate`: code exists, but it must be proven with fake tenants, real services, hardware, native builds, or store sandboxes before real/customer production use.
- `External`: requires Cloudflare dashboard, store consoles, legal/payroll review, hardware, DNS/domain, or native-device setup.
- `Debug If Failed`: no current known code blocker, but failed manual validation becomes the next code/debug task before real restaurant data continues.

1. Authorization and permission model - Validated
- Exact capabilities, business membership roles, manager/owner authority, consultant/contractor limits, route gating, and admin/report/vendor/device/billing/HR access are guarded by `test:tenant-authority` and `test:authorization-capabilities`.
- Debug If Failed: any role that sees another business, opens unauthorized admin/report/HR routes, or bypasses feature hiding.

2. Operational event and notification foundation - Validated / Manual Gate
- `2. Operational event and notification foundation` is implemented as business-scoped operational events with delivery state, dedupe, failure tracking, and internal-token processing.
- Manual Gate: process operational events with fake tenants and confirm emails/events route only to intended users.
- Debug If Failed: incorrect recipient targeting, duplicate events, missing event writes, or cross-business notifications.

3. Email system completion - Validated / Manual Gate
- `3. Email system completion` code is validated: branded Resend helper, invite, approval, password reset, employee onboarding, and operational email wiring exist.
- Required Cloudflare secret: `RESEND_API_KEY` plus sender/reply-to values.
- Manual Gate: Run deferred Phase 3 real email flow tests for invite, approval, password reset, employee onboarding, schedule, shift, time-off, list, billing, and temperature emails.
- Debug If Failed: delivery failure, wrong branding, wrong recipient, missing idempotency, or technical config text exposed to users.

4. Native push notification foundation - Validated / External
- `4. Native push notification foundation` exists: Capacitor plugin, token storage, register/revoke endpoints, settings opt-in, and native client registration.
- Phase 4 remaining needs: configure APNs/FCM credentials, wire push delivery into the operational event processor, verify token refresh on real iOS/Android devices, revoke only the current device on logout, and test live event-triggered notifications after native builds exist.
- Debug If Failed: token persistence, revoke behavior, preference respect, or native runtime errors.

5. Temperature monitoring completion - Validated / Manual Gate / External Hardware
- Code foundation is validated: ESP32-C6 gateway/node serial model, tenant-scoped ingest, thresholds, stale/offline/recovery/high/low events, acknowledgements, reports, and bounded API payloads.
- Phase 5 hardware pass: pre-provision gateway and sensor-node serials in `iot_device_inventory`; claim one gateway in `/admin/sensors`; assign multiple sensor nodes to that gateway; send gateway-authenticated readings using node serials; confirm unassigned, wrong-gateway, wrong-business, and revoked node readings are rejected.
- Phase 5 remaining needs: connect scheduled Cloudflare processing for stale/offline checks, test real sensor ingest against provisioned serials, tune thresholds by sensor type, add richer temperature history/export views if needed, and verify live polling behavior on the deployed site.
- Debug If Failed: serial claim collisions, wrong tenant ingest, stale/offline processor issues, threshold tuning, or dashboard/report mismatch.

6. Scheduling workflow completion - Validated / Manual Gate
- Code foundation is validated for employee departments, roles, availability, time off, templates, drafts, autosave, publish, labor warnings, open shifts, shift offers, approvals, and My Schedule.
- Manual Gate: run schedule tests with fake tenants, many employees, department-scoped managers, autosave, publish-with-unsaved-changes, templates, labor targets, open shifts, shift offers, approvals, time off, My Schedule, event processing, and tenant isolation.
- Debug If Failed: draft loss, publish mismatch, wrong manager scope, employee visibility errors, or schedule report/history gaps.

7. Lists, completion history, and alerts - Validated / Manual Gate
- Code foundation is validated for checklist/prep/inventory/order lists, item save/edit/delete, item attachments, two-week prep history, list reports, CSV safety, and tenant scoping.
- Manual Gate: create, edit, delete, submit, and export list data with multiple fake employees and businesses.
- Debug If Failed: missing executor/submitter, stale UI after save, attachment opening issues, completion alert routing, or cross-tenant list rows.

8. Reports and exports completion - Validated / Manual Gate
- Tracked launch phase: `8. Reports/export foundation`.
- Reports and exports completion is validated for schedule, requests, temperature, onboarding, waste, and list domains with CSV hardening and sensitive onboarding exclusions.
- Manual Gate: open reports as owner, manager, consultant, contractor, and staff; confirm read-only access, denial behavior, row limits, spreadsheet opening, and tenant isolation.
- Debug If Failed: unbounded queries, missing rows, formula injection, sensitive data leakage, or cross-tenant exports.

9. Billing and store subscription lifecycle - Validated / External Store Gate
- Code foundation is validated: Trial identity claims prevent free-trial reuse, cancellation creates a pre-purge snapshot, native purchase submissions stay pending until Apple/Google verification, webhooks are token-gated, entitlement lifecycle updates are wired, and pricing is Small `$30/mo`, Medium `$65/mo`, Large `$90/mo`.
- Manual Gate: create App Store Connect and Google Play products, sandbox testers, native builds, and test purchase/restore/cancel/refund/renewal/grace/past-due flows.
- Debug If Failed: product mismatch, verification failure, entitlement leak, wrong tenant activation, or billing status mismatch.

10. Invite, employee onboarding, and HR completion - Validated / Manual Gate / Legal Review
- Code foundation is validated for owner, manager, employee, consultant, and contractor invite paths; employee invite flow from email link to onboarding to login; packet requirements; encrypted sensitive vault; audited reads; and onboarding reports.
- Manual Gate: Phase 10 invite/onboarding pass with fake employees, packet submission, review, changes requested, approval, HR-sensitive media, and admin review routes.
- Legal Gate: contractors do not receive employee tax onboarding packets, but I-9/W-4/state form procedures still need qualified legal or payroll guidance.
- Debug If Failed: wrong invite role path, business/pricing appearing on employee invite, packet misassignment, media access leak, or HR audit gaps.

11. Creator, editor, and legacy route consolidation - Validated
- `/admin/creator` is the editor source of truth; legacy admin editor routes redirect; feature hiding applies to shared creator routes.
- Debug If Failed: duplicate editor access, old hardcoded categories/data, or feature-hidden routes still opening.

12. Core feature action test - Validated / Manual Gate
- `12. Core feature action test` is guarded for lists, docs, menus, recipes, ToDo, whiteboard, specials, announcements, spotlight, vendors, reminders, conversions, food cost, safety reference, waste tracker, waste reports, and business registry.
- Phase 12 core action pass: create, edit, delete, and view real data in fake tenants before real restaurant entry.
- Debug If Failed: save/delete failure, stale UI, wrong sidebar visibility, permission mismatch, or cross-tenant data.

13. Camera feature shelving - Validated / Deferred
- `13. Camera feature shelving` is complete for launch. Camera UI, purchase paths, active marketing promises, and product activation are hidden/blocked.
- Camera monitoring products are deferred post-launch. Backend and R2 code remain beta-gated for later work.
- Debug If Failed: visible camera menu, selectable camera product, camera API available without beta, or marketing claiming active cameras.

14. Authentication, session, abuse, and account lifecycle - Validated / Manual Gate
- Code foundation is validated for login, logout, register, invite, reset password, account deletion, session/device revocation, inactive users, feature hiding, internal APIs, device APIs, billing webhooks, Turnstile login, same-origin request guard, and malicious-user hardening.
- Manual Gate: wrong password/email, rate limits, expired reset token, invalid/reused invite, revoked session/device, inactive user, direct route probing, and account deletion requests.
- Debug If Failed: session cookie leak, route bypass, missing audit log, or account lifecycle inconsistency.

15. Production database and Cloudflare readiness - Validated / Manual Gate
- Code/config foundation is validated: Pages config, D1/R2 bindings, schema guard, Node version, package lock, no copied-app Cloudflare resources, Turnstile secret names, WAF/rate-limit note, and schema readiness endpoint.
- Manual Gate: backup/export D1, apply/confirm migrations on target environment, run `schema:readiness:prod`, run `smoke:prod`, confirm preview/production separation, and only then add real restaurant data.
- Debug If Failed: schema mismatch, missing secrets, wrong Pages project, wrong binding, or deployment/runtime error.

16. Performance, scale, and reliability - Validated / Manual Gate
- Scale/performance static checks pass: bounded polling, bounded cleanup, bounded temperature payloads, business-first indexes, private media streaming, and route payload trimming.
- Manual Gate: run load-style fake tenant tests for schedules, reports, list submissions, temp ingest, temp polling, concurrent tenants, and user switching on Cloudflare.
- Debug If Failed: worker resource warnings, slow route, heavy polling, unbounded D1 writes, or oversized route payload.

17. Observability, backup, and incident readiness - Validated / External
- Structured Logs, Alert Targets, Alert watchlist, and Backup And Restore notes exist.
- External Gate: configure Cloudflare notifications/log monitoring and run one D1 export/restore drill plus one rollback drill before public launch.
- Debug If Failed: missing context in logs, sensitive log leakage, broken rollback, or backup restore gap.

18. Crimini UI, accessibility, and responsive polish - Validated / Manual Gate
- UI static guards pass for current theme, focus treatment, reduced motion, old icon removal, and subtitle cleanup.
- Manual Gate: inspect app/admin/auth/onboarding/billing/schedule/reports/tools/docs/menus/marketing in light/dark and mobile/desktop.
- Debug If Failed: clipped footer/sidebar, contrast issues, verbose helper copy, old rounded-card styling, or broken mobile layout.

19. Native app release preparation - External / Manual Gate
- Native shell config and store readiness code exist, but real native builds require local Android/iOS setup.
- Manual Gate: configure JDK/JAVA_HOME, Android signing, iOS/TestFlight, `cap:sync`, device testing, uploaded docs/PDFs, session persistence, push, billing bridge, and account deletion.
- Debug If Failed: native-only login, file, billing, push, or deep-link issues.

20. Apple App Store readiness - Validated Code / External
- `20. Apple App Store readiness` code checks pass for bundle ID, public URLs, billing page, and readiness guards.
- External Gate: App Store Connect app record, IAP subscription products, screenshots, metadata, TestFlight, privacy disclosures, demo account, and review notes.
- Debug If Failed: IAP product mismatch, restore failure, privacy URL issue, native billing bridge issue, or Apple review blocker.

21. Google Play Store readiness - Validated Code / External
- `21. Google Play Store readiness` code checks pass for Android identity, Play Billing dependency, support/privacy/account deletion URLs, Google Play Console notification wiring, data safety references, internal testing readiness, `crimini.plan.small.monthly`, and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` expectations.
- External Gate: Play Console app record, subscription products, Data safety, content rating, screenshots, metadata, internal testing track, demo account, and review notes.
- Debug If Failed: Play Billing product mismatch, notification verification failure, restore issue, or Android runtime issue.

22. Legal, public site, and business readiness - Validated Routes / External
- `22. Legal, public site, and business readiness` routes exist for privacy policy, terms, billing terms, support contact, account deletion, footer links, billing disclosures, and account deletion request persistence.
- External Gate: qualified legal or payroll guidance for privacy policy, billing terms, support contact, employee forms, I-9/W-4/state guidance, trial/payment/cancellation language, device monitoring, and retention.
- Debug If Failed: public route missing, incorrect footer/support link, account deletion issue, or legal-required copy change.

23. Production smoke and multi-tenant validation - Next Required Gate
- Deploy to the intended Cloudflare Pages environment after the public/domain hold is handled or use the current Pages preview URL for private testing.
- Run `npm.cmd run schema:readiness:prod` and `npm.cmd run smoke:prod`.
- Run the Final Multi-Tenant Test Notes with fake tenants first.
- If fake tenants pass, enter the three restaurant tenants.
- Debug If Failed: fix the failing system before adding more real data.

24. Store internal testing - External / Manual Gate
- Upload Android internal testing and iOS TestFlight builds after native signing/setup.
- Test real purchase sandbox flows, onboarding, invite links, deep links, logout, reset password, media uploads, push notifications, and account deletion.
- Debug If Failed: store/native specific code fix before public review.

25. Launch candidate - Final Gate
- Freeze feature changes.
- Run the full validation suite.
- Complete the final manual test matrix.
- Push the final GitHub commit.
- Deploy the final Cloudflare build.
- Submit Apple and Google builds.
- Keep backup, incident, and rollback plans ready.

