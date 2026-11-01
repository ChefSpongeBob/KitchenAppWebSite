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

- Last full static validation: 2026-10-31 after the staff-maintenance closing pass; native production UI build and expanded staff SQL/Workers tests also passed. This is functional validation, not closure of the open dependency-security gate.
- Current repository status: functional foundations and staff-console code are validated, but dependency-security remediation and deployment/manual gates remain open. Do not interpret passing static tests as public-launch clearance.
- Current hold: public production launch and live-domain customer onboarding still wait for trademark/LLC timing, final legal/payroll review, store setup, and live operational integrations.
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
- Native push foundation: Capacitor plugin, token storage/revoke endpoints, user preferences, and native client registration plumbing.
- Temperature monitoring code foundation: gateway/node serial model, device auth, tenant-scoped temperature/humidity ingest, packet sequence/nonce/LQI diagnostics, thresholds, alert events, automatic recovery, stale processor endpoint, history/report wiring, and bounded ingest.
- Billing/store lifecycle code foundation: native purchase submission, pending entitlements, Apple/Google verification paths, token-gated webhooks, entitlement reconciliation, and launch pricing.
- Cloudflare readiness: Pages config, D1/R2 bindings, schema guard, Node version, package lock, no old copied-app Cloudflare bindings, and deploy readiness checks.
- UI/readiness guards: current Crimini UI requirements, accessibility/focus checks, legal/support/public routes, Apple/Google readiness checks, and production build.

## Remaining Launch Work

Dependency security gate (2026-10-31, open): production-only audit reports 10 affected packages (three critical, three high, four moderate); the full audit reports 22 (three critical, twelve high, five moderate, two low). The full audit also covers SvelteKit/shipped serialization code, not just tooling. Review/remediate Capacitor Android/iOS 8.4.0 (GHSA-rvm3-566m-v7fv), PDF.js 5.7.284 (GHSA-hq66-cqwq-w95j), SvelteKit/devalue, Vite/PostCSS/source-map-js/nanoid, Wrangler/Miniflare/sharp/undici, and the CLI tar/xmldom/glob/minimatch/brace-expansion/rimraf chain. Deepmerge has no published patched release in the checked 4.x line; assess its build-config-only use rather than suppressing the alert. Audit findings are dependency flags, not proof of exploitation. The next-major-pass sequence below owns remediation; no framework or dependency upgrade has started. No `audit fix --force`, incompatible CLI downgrade, or hiding unresolved advisories. Maintainer references: https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv and https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j.

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
- The user explicitly rejected passkeys, authenticator applications, and replacement email codes. Staff access uses the existing account password plus password reconfirmation; this is NOT MFA. Do not reintroduce another authentication method without explicit approval.
- Migration 0110 removes the rejected credential/challenge tables and obsolete proof column, invalidates existing staff confirmations, and preserves primary sessions, account credentials, memberships, last-owner guards, and audit history. Historical applied migrations remain immutable. Deploy the compatible password-only code before applying the cleanup to avoid breaking the previous staff implementation.
- Suspected staff compromise: another verified platform owner revokes affected staff membership and verifies denial. An authorized Cloudflare operator must independently verify and obtain approval for any sole-owner recovery; preserve audit evidence and never alter tenant roles or billing as a shortcut. Existing primary account/session compromise procedures still apply.
- Approve retention/export/deletion and incident procedures before launch; no arbitrary automatic audit deletion was introduced. Never enter secrets or employee HR data in maintenance reasons.

Current checkpoint:
- The staff/Wi-Fi foundation was pushed as `a0439a3`; live staff entry and login-form routing were verified. Manual authenticated access/UI review remains open.
- Password-only removal: full static regression, web/native builds, ordinary-form access/rollback/expiry tests, and a clean Linux-targeted npm 10.9.2 install (207 packages) passed on 2026-10-31. Migration 0110 is applied locally; a production D1 export is saved in ignored `.db-backups/before-staff-password-only-20261031.sql`. Production deployment and cleanup application are the remaining release steps. No restaurant login, billing gate, tenant role, password hash, credential reset, or firmware change is part of this removal.
- The approved owner remains the existing account `spongebobchefpants@gmail.com`. That email is absent locally: do not create a local identity, copy production inventory, or change local database targets.
- Manual gates: staff entry/sign-in/password confirmation in DuckDuckGo, cancelled navigation/retry/expired confirmation, owner/support/equipment/nonstaff views, multi-tab/device revocation, inactive-account revocation, audit readability, desktop/mobile layout, both-business equipment/health isolation, and real D1 concurrency. Confirm ordinary restaurant logins and billing restrictions are unchanged.
- Next coding phase remains the framework/dependency-security sequence below. Known dependency advisories are still open; no major upgrade, redesign, or hardware work is part of this removal.

### Next Major Pass: Framework And Dependency Security

Planned after the staff-console code checkpoint; not started. The user asked to finish staff maintenance first and retain this larger upgrade in the single list. Do not bundle it into an unrelated UI, firmware, or database edit.

1. Patch critical native/PDF dependencies first, regenerate native dependency references, and validate PDF rendering/worker compatibility and unchanged native networking/billing/push. The native fixes require rebuilt binaries; a website deployment alone does not repair an already installed app. Establish a validated repository checkpoint before framework migration.
2. Inventory and migrate to stable SvelteKit 3 with compatible Cloudflare/static adapters, Node >=22.17, TypeScript 6, Svelte >=5.57.1, and compatible Vite/plugin versions. Move configuration from `svelte.config.js` to the Vite plugin, preserve separate web/native build outputs, and update Cloudflare build-version configuration deliberately. Official guide: https://svelte.dev/docs/kit/migrating-to-sveltekit-3.
3. Migrate Cloudflare environment/context access, hook/types, cookies, form actions/status handling, navigation/invalidation, aliases/env imports, and build/test harnesses as required by the guide. Preserve tenant authority, primary-password hashing, exact native-origin/CSRF checks, session semantics, store callbacks, and sensitive-data access. No redesign, feature changes, or data/schema restructuring by assumption.
4. Resolve the remaining dependency tree deliberately, including build tooling and the existing overrides. Use compatible patched versions, verify any necessary transitive API override with real tooling tests, retain complete cross-platform lock metadata, and test a clean Linux install with Cloudflare's npm version. Re-audit the full and production dependency trees. Any unpatched upstream finding needs a documented applicability/mitigation decision, not suppression or a claim of zero risk.
5. Run full type/build/regression tests, real Cloudflare-runtime checks, native packaging, and Android compilation without installing on the user's phone. iOS compilation requires macOS/Xcode. Revalidate login/logout/reset, invited/purchaser onboarding, staff password confirmation/roles, billing/store callbacks, tenant isolation, scheduling, lists/docs/PDF/uploads, reports, email/push, and sensor ingest/Wi-Fi setup; retain every existing manual test below. No physical hardware flashing.
6. Review the exact diff and deployment/migration needs, deploy only at the agreed checkpoint, and validate the same commit on Cloudflare plus rebuilt Android/iOS binaries. Keep public signup and billing/tenant gates intact. Do not resume real customer/SPPI rollout while critical/high findings remain unaddressed.

### Launch Validation And Integrations

1. Cloudflare private validation setup
- Enable private test protection on the target Pages environment.
- Confirm `DB`, `DOC_MEDIA`, `APP_BASE_URL`, `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `PASSWORD_PEPPER`, Resend secrets, billing secrets, and Turnstile secrets.
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
- Gateway Wi-Fi setup uses a protected temporary gateway network and a local browser page, reachable from Registered Equipment on desktop or phone. Review the compact UI/copy with the owner before pushing. Bluetooth provisioning plugins, dependencies, and permission prompts are removed.
- Physical provisioning checks remain open: claim by serial and confirm registration automatically opens and focuses that gateway's Wi-Fi guide on the same page; join the exact gateway setup network using its displayed setup password; select or enter restaurant Wi-Fi; test incorrect password, hidden SSID, interrupted setup, retry, gateway reboot, and router reboot; reconnect the computer/phone to normal Wi-Fi and require a new authenticated gateway check-in. Confirm no restaurant SSID/password enters D1, Cloudflare logs, audit metadata, or app storage.
- Verify recovery timing on real hardware: after 10 minutes of failed Wi-Fi joins the gateway pauses radio reception and offers setup. Existing credentials are preserved until Wi-Fi and the authenticated cloud check succeed. With a saved network, setup times out after 10 minutes and normal receive/retry resumes. While no user is attached, the setup loop also retries the saved network. Check multiple nearby gateways, restoration of the old router, and transition to a replacement router. Setup requires a Wi-Fi-capable computer or phone; the public site does not contact local addresses in the background.
- Confirm gateway-only check-in and Wi-Fi failure recovery with no registered nodes: the gateway checks in every five idle minutes when there is no recent successful upload. These status-only requests must not insert temperatures, refresh sensor timestamps, or affect other tenants.
- Tune thresholds by sensor type and verify high, low, stale, offline, recovery, dashboard, polling, and report behavior.
- Deploy the operational dispatcher with its `DB` binding and `SMOKE_INTERNAL_TOKEN`; it processes tenant temperature stale/offline alerts in bounded batches every five minutes.
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
