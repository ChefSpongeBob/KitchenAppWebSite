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
- Required secrets include `SMOKE_INTERNAL_TOKEN`, `SENSITIVE_DATA_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_STORE_PRIVATE_KEY`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, and `BILLING_WEBHOOK_TOKEN`.

## Validation Gates

Run local/static gates before pushes or large changes:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run mobile:check
npm.cmd run test:tenant-authority
npm.cmd run test:authorization-capabilities
npm.cmd run test:operational-events
npm.cmd run test:tenant-isolation
npm.cmd run test:iot-device-auth
npm.cmd run test:media-access
npm.cmd run test:production-schema
npm.cmd run test:scale-performance
npm.cmd run test:auth-abuse
npm.cmd run test:hr-onboarding
npm.cmd run test:admin-consolidation
npm.cmd run test:billing-lifecycle
npm.cmd run test:store-release
npm.cmd run test:cloudflare-readiness
npm.cmd run test:security-headers
npm.cmd run test:observability
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

## Store Billing

- Native app id / bundle id: `com.nexusnorthsystems.crimini`.
- Store products must be created in App Store Connect and Google Play before sandbox tests.
- Product IDs currently expected by the app/store plan include `crimini.plan.small.monthly`, `crimini.plan.medium.monthly`, `crimini.plan.large.monthly`, temp monitoring, and camera monitoring equivalents.
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

- Active phase: `11. Creator, editor, and legacy route consolidation`
- Status: In progress
- Current pass: Phase 11A consolidated content-editor navigation. `/admin/creator` now owns category, list, recipe, document, menu, and item-attachment editing; `/admin/category-creator`, `/admin/lists`, `/admin/menus`, `/admin/documents`, and `/admin/recipes` remain as redirect routes into Creator Studio.
- Return point after branch work: Continue Phase 11 with read-only inventory of old Svelte-only admin pages, unused copied-app assets, and remaining legacy editor files before deleting anything.
- Last verified: 2026-06-06 focused Phase 11A validation passed: `npm.cmd run test:admin-consolidation`, `npm.cmd run test:authorization-capabilities`, `npm.cmd run test:hr-onboarding`, `npm.cmd run check`, and production `npm.cmd run build` outside the sandbox. D1 migrations are current locally and remotely. Public-route local smoke and authenticated smoke were not rerun in this pass.
- Completed local phases: `1. Authorization and permission model`, `2. Operational event and notification foundation`, `3. Email system completion`, `4. Native push notification foundation`, `5. Temperature monitoring foundation`, `6. Scheduling workflow foundation`, `7. Lists/history/alert foundation`, `8. Reports/export foundation`, `9. Billing/store lifecycle foundation`, `10. Invite/onboarding/HR guardrails`

## Final Multi-Tenant Test Notes

- Employee permissions pass: in `/admin/users`, search by name, email, department, role, and permission template; open an employee through `Permissions`; change account type, permission template, capability checkboxes, department access, and delete only in test tenants. Repeat as owner, manager, staff, consultant, and contractor. Confirm staff cannot directly open admin, reports, vendor, HR-sensitive, billing, device setup, or permission routes.
- Session cleanup note: employee login sessions are security plumbing, not normal staff-management UI. Revoke-session behavior should be tested later through account/security lifecycle tests, not the visible staff manager page.
- Phase 5 temp pass: register gateway/sensor serials, ingest valid readings, trigger high/low/stale/offline/recovery states, acknowledge alerts, verify wrong-business/wrong-serial/revoked-device rejection, and confirm dashboard/temp pages stay tenant scoped.
- Phase 6 schedule pass: create two businesses with separate employees; set owner, general manager, FOH manager, BOH manager, hourly manager, shift lead, consultant, contractor, and staff permissions; confirm each role/template/individual override sees only the correct schedule tools. Test department-scoped managers against FOH-only and BOH-only employees, including schedule builder visibility, shift creation, publish, approvals, templates, labor targets, and open shifts.
- Phase 6 schedule save/publish pass: add shifts, edit shifts, delete shifts, duplicate a day, navigate away and back to confirm autosaved draft data remains, publish with unsaved changes, confirm publish creates the final schedule, and verify schedule publish history/report exports still show the published week.
- Phase 6 employee schedule pass: log in as staff and verify `/schedule` and `/my-schedule` only show published shifts for that business/user; create availability, time-off requests, open-shift requests, shift offers, targeted shift offers, approvals, declines, withdrawals, and manager decisions. Confirm every action is tenant scoped and unavailable to unrelated businesses.
- Phase 6 notification pass: process operational events after schedule publish, shift offer, shift request, open-shift request, approval, decline, and time-off decisions; confirm emails route to opted-in users, managers, affected employees, and eligible department employees only.
- Phase 7 list pass: create checklist, prep, inventory, and order lists; add/edit/delete items; attach recipes and SOPs; submit counts/completions; reopen completed items; verify new items appear immediately; confirm saved inputs clear after save; confirm deleted lists/items disappear everywhere they should.
- Phase 7 history/alert pass: submit prep and checklist data as multiple employees; verify submitter and executor fields; confirm two-week prep history, checklist history, CSV/export behavior, completion alerts, item-completed events, and tenant isolation across two businesses.
- Phase 7 report URL pass: verify `/reports/lists?domain=preplists`, `/reports/lists?domain=inventory`, `/reports/lists?domain=orders`, and `/reports/lists?domain=checklists`; download each matching CSV and confirm date, list, item, action/value, completed-by, and submitted-by fields.
- Phase 7 event delivery pass: after list submission, item completion, item reopen, and full-list completion, run the operational event processor; confirm opted-in manager/content-access users receive the correct alerts and unrelated business users receive nothing.
- Phase 8 reports pass: open `/reports`, `/reports/schedule`, `/reports/requests`, `/reports/temperature`, `/reports/onboarding`, and all list report domains as owner, manager, consultant, contractor, and staff. Confirm permitted roles are read-only, staff is blocked, each route stays inside the active business, and CSV exports match the visible rows.
- Phase 8 CSV pass: download schedule, requests, temperature, onboarding, prep, inventory, order, and checklist CSVs with real data; open in spreadsheet software; confirm no sensitive onboarding form payloads, document URLs, password/session data, or cross-business rows appear.
- Phase 9 billing pass: create matching Apple and Google sandbox products; purchase starter, growth, enterprise, temperature add-on, and camera add-on from native builds; restore purchases; confirm entitlements activate the correct business only; cancel auto-renew without early lockout; test renewal, grace, hold/past-due, refund/revoke, and expiration notifications; confirm webhook rows become processed/failed/ignored and billing status updates match store state.
- Phase 10 invite/onboarding pass: from `/admin/onboarding`, create owner-blocked, manager, employee, consultant, and contractor invites; open the email link into `/register?invite=...`; confirm employee registration skips business/pricing controls and lands at `/login`; log in and complete packet items from `/settings`; review, request changes, approve, and view source forms from `/admin/users/[id]` and `/admin/onboarding`; confirm contractor invites do not create employee tax packets; confirm staff cannot open HR-sensitive media or admin review routes; confirm owner/manager HR-sensitive access is audited and business scoped.

## Launch Completion List

This is the only active completion checklist. Work it in order and do not create additional scattered task lists.
Next Phase List refers to this launch completion list.

Current audit status:

- Core app routes, tenant scoping, authenticated local smoke, static validation, IoT authentication, private media, security headers, observability, and local migrations pass.
- The system is not feature-complete until granular permissions, operational notifications, native push, temperature alert rules, billing webhook processing, report depth, live integrations, and store testing are complete.

1. Authorization and permission model
- Define exact capabilities for owner, manager, general manager, FOH manager, BOH manager, hourly manager, shift lead, consultant, contractor, staff, and user.
- Enforce business membership role and permission template on every privileged page, action, endpoint, and export.
- Enforce manager department scope in schedule builder, schedule approvals, templates, labor targets, and employee scheduling.
- Keep consultants and contractors read-only where intended, including reports and vendors.
- Confirm regular users cannot access admin, HR-sensitive, vendor, report, device setup, or billing administration actions.
- Add automated role and department access tests.

2. Operational event and notification foundation
- Create a business-scoped event or outbox system for operational changes.
- Record events for schedule publish, shift offers, shift requests, approvals, declines, time off, list completion, onboarding, temperature alerts, device state, and billing changes.
- Add deduplication, retry status, failure status, timestamps, and audit metadata.
- Keep delivery event-driven instead of adding more page polling.
- Add retention rules for delivered and failed events.

3. Email system completion
- Confirm Resend domain and sender are verified.
- Confirm `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and reply-to are set in Cloudflare.
- Test invite, approval, password reset, and employee onboarding emails.
- Add operational emails for schedule publishing, shift activity, time-off decisions, onboarding status, and configured alerts.
- Respect each user's `email_updates` preference.
- Add delivery failure logging and retry handling.
- Remove any user-facing technical configuration warnings.

4. Native push notification system
- Add Capacitor push notification support for iOS and Android.
- Store device tokens per user, business, platform, and device.
- Add opt-in, opt-out, token refresh, logout cleanup, and revoked-device handling.
- Deliver temperature, schedule, shift, approval, and other configured operational alerts.
- Respect user notification preferences.
- Test APNs and FCM delivery on real devices.
- Phase 4 remaining needs: configure APNs/FCM credentials, wire push delivery into the operational event processor, verify token refresh on real iOS/Android devices, revoke only the current device on logout, and test live event-triggered notifications after native builds exist.

5. Temperature monitoring completion
- Add per-business and per-sensor high and low thresholds instead of hardcoded display thresholds.
- Add stale, offline, recovery, high-temperature, and low-temperature events.
- Add alert cooldown, deduplication, acknowledgement, and recovery behavior.
- Add temperature history and export.
- Confirm device provisioning creates unique serials and per-business device credentials.
- Confirm device auth rejects wrong business, wrong serial, revoked device, and invalid credentials.
- Confirm temp ingest stores under the correct business.
- Confirm dashboard cards, temp page, node names, history, and alerts update correctly.
- Test live polling and sustained ingest under production Cloudflare.
- Phase 5 remaining needs: connect scheduled Cloudflare processing for stale/offline checks, test real sensor ingest against provisioned serials, tune thresholds by sensor type, add richer temperature history/export views, and verify live polling behavior on the deployed site.

6. Scheduling workflow completion
- Test employee departments, roles, availability, time off, templates, drafts, autosave, publish, labor warnings, open shifts, shift offers, approvals, and My Schedule.
- Confirm managers can only schedule and approve within allowed departments and permissions.
- Confirm publish can run without requiring a separate draft save first.
- Add schedule publish, shift offer, shift request, approval, decline, and time-off notifications.
- Decide whether Crimini needs true reciprocal shift swaps in addition to shift transfer and claim.
- Confirm employee schedule visibility and every schedule mutation are tenant scoped.
- Confirm schedule publish history remains available for the required retention period.
- Phase 6 manual validation needs: run the schedule pass from Final Multi-Tenant Test Notes before launch, including autosave, publish-with-unsaved-changes, department-scoped managers, templates, labor targets, open shifts, shift offers, approvals, time off, My Schedule, event processing, and tenant isolation.

7. Lists, completion history, and alerts
- Confirm checklist, prep, inventory, and order lists can be created, edited, deleted, submitted, and restored where intended.
- Detect full list completion and record who completed each item.
- Add configured completion alerts for prep lists, checklists, inventory, and orders.
- Confirm item attachments open the linked recipe or SOP directly.
- Add checklist history reporting.
- Confirm two-week prep history includes submitter and task executor detail.
- Confirm history and alert writes are business scoped and efficient.
- Phase 7 manual validation needs: run the list/report/event passes from Final Multi-Tenant Test Notes before launch, including CSV downloads, event processing, attachments, two-business isolation, and multiple-user submitter versus executor confirmation.

8. Reports and exports completion
- Add executor detail to list history.
- Add checklist, time-off, shift-request, temperature, onboarding, and other useful operational exports.
- Confirm consultant and contractor report access is read-only and tenant scoped.
- Add pagination, chunking, or asynchronous exports so large reports do not silently stop at fixed row limits.
- Confirm schedule history supports the required retention period.
- Test CSV files with real data and external spreadsheet tools.
- Phase 8 current foundation: schedule requests, temperature monitoring, and onboarding status reports/CSVs exist; report queries are bounded and business scoped; `test:report-exports` guards report access, CSV endpoints, sensitive onboarding exclusions, and report links.
- Phase 8 manual validation needs: run the reports and CSV passes from Final Multi-Tenant Test Notes before launch, including owner/manager/consultant/contractor/staff access, read-only behavior, spreadsheet opening, row-limit behavior, sensitive onboarding exclusion, and two-business isolation.

9. Billing and store subscription lifecycle
- Finalize Apple and Google product IDs.
- Create subscription tiers and add-ons in App Store Connect and Google Play Console.
- Match store product IDs to Crimini billing configuration.
- Keep native purchase submissions pending until Apple or Google verification succeeds.
- Process Apple and Google webhook events into entitlement renewals, cancellations, refunds, grace periods, billing failures, and expirations.
- Add webhook retry, failure monitoring, deduplication, and processed status updates.
- Confirm webhook endpoints require `BILLING_WEBHOOK_TOKEN`.
- Test native purchase, restore, billing status, entitlement activation, trial conversion, cancellation, and data retention.
- Remove or rename remaining billing placeholder language before launch.
- Phase 9 current foundation: native purchase verification, restore submission, billing status, webhook token auth, webhook dedupe, entitlement lifecycle updates, business billing reconciliation, and lifecycle lookup indexes exist.
- Phase 9 manual validation needs: run the billing pass from Final Multi-Tenant Test Notes after App Store Connect, Google Play Console, native builds, and sandbox tester accounts are ready.

10. Invite, employee onboarding, and HR completion
- Test owner, manager, employee, consultant, and contractor invites.
- Test employee invite flow from email link to onboarding to login.
- Confirm employee onboarding skips business pricing and keeps valid entered data after validation errors.
- Confirm employee packet fields, in-app forms, source document uploads, profile attachment, admin review, changes requested, approval, and document access work.
- Confirm contractors do not receive employee tax onboarding packets.
- Confirm sensitive HR, tax, identity, and bank fields use encrypted storage and audited reads.
- Confirm HR-sensitive permissions are enforced.
- Review I-9, W-4, state forms, signatures, retention, and employer procedures with qualified legal or payroll guidance.
- Confirm legacy admin aliases resolve cleanly to Manager behavior without duplicated user-facing roles.

11. Creator, editor, and legacy route consolidation
- Confirm `/admin/creator` is the intended source of truth for list, recipe, document, menu, category, and attachment creation.
- Retire or redirect duplicate legacy editor routes without losing valid functions.
- Confirm feature hiding applies to shared creator routes and not only sidebar links.
- Remove dead compatibility code, old copied-app bindings, unused assets, visible hardcoded data, and test data.
- Review remaining internal legacy naming and rename only where it is safe and useful.

12. Core feature action test
- Lists: create, edit, delete checklist, prep, inventory, and order lists.
- Docs: upload PDFs, create categories, view docs, delete files, and replace files.
- Menus: upload separately from docs and confirm homepage menu card reflects active menus.
- Recipes: create categories, add recipes, edit, delete, view by category, and attach to list items.
- ToDo: create, assign, complete, reopen, delete, and verify feature hiding.
- Whiteboard: submit, vote, review, approve, reject, and cleanup.
- Specials: create and confirm the homepage special area stays clean.
- Announcements and spotlight: edit permissions and homepage display.
- Vendors, reminders, conversions, and business registry: confirm save, edit, delete, access, and tenant behavior.

13. Camera system completion
- Confirm camera device provisioning, unique serial registration, naming, and revoke flow.
- Confirm camera upload endpoint accepts only valid authenticated image and video uploads.
- Confirm R2 media is private, business scoped, and no-store.
- Confirm camera dashboard, preview, events, delete, and retention cleanup work.
- Confirm wrong business, wrong serial, revoked device, and invalid credentials are rejected.
- Test real device or simulator uploads against production.

14. Authentication, session, abuse, and account lifecycle test
- Test every major route locally with fresh admin and employee accounts.
- Confirm login, register, invite, onboarding, logout, reset password, continue signed-in, tenant switching, and account deletion.
- Test wrong password, wrong email, too many attempts, expired reset token, invalid invite, reused invite, inactive user, revoked session, and revoked device.
- Confirm feature hiding removes sidebar visibility and direct route access.
- Confirm delete and trial-cancel flows preserve only required trial-abuse records.
- Confirm no admin endpoint accepts regular user access.
- Confirm every public API endpoint requires the correct user auth, device credential, internal token, or webhook token.

15. Production database and Cloudflare readiness
- Confirm all D1 migrations are applied locally and remotely.
- Create or confirm a backup before production migrations.
- Run schema readiness against production Cloudflare bindings.
- Confirm every tenant-owned table is business scoped.
- Confirm Pages has the correct D1, document R2 bucket, camera R2 bucket, environment variables, and secrets.
- Confirm preview and production bindings are separated correctly.
- Confirm `criminiops.com` points to the intended Pages project when the hold is lifted.
- Confirm no old copied-app Cloudflare resources remain.

16. Performance, scale, and reliability
- Run Cloudflare readiness, scale performance, tenant isolation, production schema, media access, build, auth abuse, billing, security header, and observability checks.
- Inspect heavy routes for payload size and query count.
- Confirm polling is limited, visibility aware, and not used for event delivery.
- Confirm pages do not load full document or media content when only listings are needed.
- Confirm R2 media streams where practical instead of buffering large files.
- Load test schedules, reports, list submissions, temp ingest, camera activity, and concurrent tenant use.
- Confirm cleanup and retention jobs are bounded and do not create excessive D1 writes.

17. Observability, backup, and incident readiness
- Configure alerts for schema failures, tenant denials, billing failures, repeated 500s, media denials, device auth failures, temperature alerts, and notification delivery failures.
- Confirm structured logs provide enough business, route, event, and failure context without exposing sensitive data.
- Confirm D1 backup, migration rollback, forward-fix, and R2 recovery procedures.
- Confirm a failed deployment can be rolled back safely.

18. Crimini UI, accessibility, and responsive polish
- Use the current Crimini UI system for every component changed during this completion plan.
- Sweep all app, admin, auth, onboarding, billing, schedule, report, device, docs, menu, and marketing pages for theme consistency.
- Remove old rounded floating-card styling, glow-heavy panels, oversized buttons, nested cards, and mismatched visual patterns.
- Fix light-mode and dark-mode contrast everywhere.
- Confirm desktop and mobile layouts, including complex schedule and admin pages.
- Standardize empty, loading, error, disabled, success, and permission-denied states.
- Keep UI copy short and remove technical or over-explained user-facing text.
- Check keyboard navigation, focus states, labels, contrast, and screen-reader behavior.
- Replace outdated marketing screenshots when final app screenshots are ready.

19. Native app release preparation
- Configure a working JDK and Android build environment.
- Configure Android signing keystore values and secure release signing.
- Enable Android release minification if practical.
- Generate Android and iOS release builds.
- Confirm final app icons, launch/loading behavior, permissions, camera/media usage, and WebView behavior.
- Confirm login and session persistence inside native shells.
- Confirm store billing bridge, push notifications, external links, PDFs, uploaded menus/docs, and account deletion work on real devices.

20. Apple App Store readiness
- Set final bundle ID, app name, listing, screenshots, privacy policy, support URL, and account deletion URL.
- Add in-app subscriptions and add-ons in App Store Connect.
- Confirm paid digital service access uses Apple In-App Purchase where required.
- Confirm subscription screen clearly shows price, term, included features, cancellation, and restore.
- Complete Apple privacy disclosures and submit IAP products with the app build.

21. Google Play Store readiness
- Set final package name, app listing, screenshots, privacy policy, data safety, and account deletion URL.
- Add Play Billing subscription products and add-ons.
- Confirm production and sandbox product IDs are not mixed.
- Confirm purchase, restore, notification, and entitlement behavior in Android builds.
- Prepare the internal testing track before public release.

22. Legal, public site, and business readiness
- Finalize privacy policy, terms, billing terms, subscription cancellation information, account deletion page, support contact, and company footer.
- Confirm Apple and Google data safety answers match actual collection and retention.
- Confirm trial, payment, cancellation, liability, employee data, and device monitoring language is accurate.
- Keep the public site offline until trademark and LLC timing is safe.

23. Production smoke and multi-tenant validation
- Deploy to Cloudflare after the domain hold is lifted.
- Run `npm.cmd run schema:readiness:prod` and `npm.cmd run smoke:prod`.
- Run deferred Phase 3 real email flow tests for invite, approval, password reset, employee onboarding, schedule, shift, time-off, list, billing, temperature, and camera emails.
- Run deferred Phase 4 real-device push tests for native opt-in, token refresh, logout/device revocation, APNs delivery, FCM delivery, and event-triggered operational alerts.
- Create at least two test business tenants with different roles and employees.
- Invite admin, manager, employee, consultant, and contractor accounts.
- Upload docs and menus.
- Create schedules, lists, ToDos, specials, announcements, temp events, and camera events.
- Purchase and restore test subscriptions in sandbox.
- Confirm tenant data isolation and access denial across every major system.

24. Store internal testing
- Upload an Android internal testing build.
- Upload an iOS TestFlight build.
- Test real purchase sandbox flows on both platforms.
- Test onboarding, invite links, deep links, logout, reset password, media uploads, push notifications, and account deletion.
- Fix store-specific issues before public review.

25. Launch candidate
- Freeze feature changes.
- Run the full validation suite.
- Complete the final manual test matrix.
- Push the final GitHub commit.
- Deploy the final Cloudflare build.
- Submit Apple and Google builds.
- Keep backup, incident, and rollback plans ready.
