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
- Do not run remote DB commands unless explicitly approved.
- Preserve business/tenant scoping on every page, action, upload, and endpoint.
- Admin authority comes from business membership role, not global user role.
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
npm.cmd run test:tenant-isolation
npm.cmd run test:iot-device-auth
npm.cmd run test:media-access
npm.cmd run test:production-schema
npm.cmd run test:scale-performance
npm.cmd run test:auth-abuse
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

## Launch Completion List

Next Phase List: this section is the active launch checklist.

Work this list in order. Do not branch into unrelated polish unless a blocker appears.

1. Phase 14: full local manual test
- Test every major route locally with fresh admin and employee accounts.
- Confirm login, register, invite, onboarding, logout, reset password, continue signed-in, and tenant switching.
- Confirm admin-only routes stay blocked from regular users.
- Confirm feature hiding removes sidebar and app access correctly.
- Confirm no visible hardcoded or test data remains.

2. Production database readiness
- Confirm all D1 migrations are applied locally and remotely.
- Run schema readiness against production Cloudflare bindings.
- Confirm every tenant-owned table is business scoped.
- Confirm sensitive HR, tax, identity, and bank fields use encrypted storage.
- Confirm delete/cancel flows preserve only required trial-abuse records.

3. Cloudflare production binding pass
- Confirm Pages project has correct D1, R2 document bucket, R2 camera bucket, env vars, and secrets.
- Confirm preview and production bindings are separated correctly.
- Confirm `criminiops.com` deployment points to the intended Pages project.
- Confirm no old copied-app bindings remain.

4. Email system
- Confirm Resend domain and sender are verified.
- Confirm `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and reply-to are set in Cloudflare.
- Test invite emails, password reset emails, employee onboarding emails, and failure handling.
- Remove any user-facing technical config warnings.

5. Invite and employee onboarding
- Test owner/admin invites.
- Test employee invite flow from email link to onboarding to login.
- Confirm employee onboarding skips business pricing.
- Confirm employee packet fields, document uploads, profile attachment, and admin review work.
- Confirm manager/admin role behavior is clean and not duplicated.

6. Billing and store payment foundation
- Finalize Apple and Google product IDs.
- Create subscription tiers in App Store Connect and Google Play Console.
- Match in-app product IDs to Crimini billing config.
- Test native purchase, restore purchase, billing status, entitlement activation, trial conversion, and cancellation.
- Confirm webhook endpoints require `BILLING_WEBHOOK_TOKEN`.

7. Apple App Store readiness
- Set final bundle ID, app name, screenshots, privacy policy, support URL, and account deletion URL.
- Add in-app subscriptions in App Store Connect.
- Confirm paid digital service access uses Apple In-App Purchase where required.
- Confirm subscription screen clearly shows price, term, included features, and restore option.
- Submit IAP products with the app build.

8. Google Play Store readiness
- Set final package name, app listing, screenshots, privacy policy, data safety, and account deletion URL.
- Add Play Billing subscription products.
- Confirm purchase and restore logic works in Android build.
- Confirm production and sandbox product IDs are not mixed.
- Prepare internal testing track before public release.

9. Capacitor/native app build
- Generate Android and iOS builds.
- Confirm app icons, launch/loading behavior, permissions, camera/media usage, and webview behavior.
- Confirm login/session persistence works inside native shells.
- Confirm store billing bridge works on device.
- Confirm external links, PDFs, uploaded menus/docs, and account deletion open correctly.

10. Temp sensor system
- Confirm device provisioning creates per-business device credentials.
- Confirm device auth rejects wrong business/device keys.
- Confirm temp ingest stores under the correct business.
- Confirm dashboard cards, temp page, alerts, node names, and history update correctly.
- Test live polling under production Cloudflare.

11. Camera system
- Confirm camera device provisioning and revoke flow.
- Confirm camera upload endpoint accepts only valid image/video uploads.
- Confirm R2 media is private and business scoped.
- Confirm camera dashboard, preview, events, delete, and retention cleanup work.
- Test real device or simulator uploads against production.

12. Core feature test
- Lists: create, edit, delete checklist, prep, inventory, and order lists.
- Docs: upload PDFs, create categories, view docs, delete/replace files.
- Menus: upload menus separately from docs and confirm homepage menu card reflects them.
- Recipes: create categories, add recipes, edit/delete, view by category.
- ToDo: create, assign, complete, reopen, delete, verify sidebar hiding.
- Whiteboard: submit, vote, review/approve if needed.
- Specials: create one or multiple specials and confirm homepage card stays clean.
- Announcements and spotlight: edit permissions and homepage display.

13. Scheduling final test
- Test employee departments, roles, availability, time off, templates, drafts, publish, labor warnings, shift swaps, shift offers, manager approvals, and My Schedule.
- Confirm managers/admins only schedule within allowed permissions.
- Confirm publish can run without requiring draft save first.
- Confirm employee schedule visibility is tenant scoped.

14. Security, abuse, and access hardening
- Run auth abuse checks.
- Test wrong password, wrong email, too many attempts, expired reset token, invalid invite, reused invite, and session logout.
- Confirm no admin endpoint accepts regular user access.
- Confirm public API endpoints require correct auth, device key, or webhook token.
- Confirm account deletion and data retention behavior.

15. Performance and scale pass
- Run Cloudflare readiness, scale performance, tenant isolation, production schema, media access, and build checks.
- Inspect heavy routes for payload size.
- Confirm polling is limited and visibility aware.
- Confirm pages do not load full document/media content when only listings are needed.
- Confirm R2 media streams instead of buffering large files.

16. UI production polish
- Sweep app pages for Crimini theme consistency.
- Fix light-mode contrast everywhere.
- Confirm mobile layouts for app, admin, schedule, onboarding, docs, menus, billing, and login.
- Replace outdated screenshots when better app screenshots are ready.
- Confirm no over-worded helper copy or technical messages remain.

17. Legal, store, and public pages
- Finalize privacy policy, terms, billing terms, subscription cancellation info, account deletion page, support contact, and company footer.
- Confirm Apple/Google data safety answers match actual collection.
- Confirm trial, payment, cancellation, and liability language is visible where needed.
- Keep public site offline until trademark/LLC timing is safe.

18. Production smoke test
- Deploy to Cloudflare.
- Create test business tenant.
- Invite admin and employee.
- Upload docs/menu.
- Create schedule, list, ToDo, special, announcement, temp/camera test event.
- Purchase/restore test subscription in sandbox.
- Confirm tenant data isolation with a second test business.

19. Store internal testing
- Upload Android internal testing build.
- Upload iOS TestFlight build.
- Test real purchase sandbox flows on both platforms.
- Test onboarding, invite links, deep links, logout, reset password, and media uploads.
- Fix store-specific issues before public review.

20. Launch candidate
- Freeze feature changes.
- Run full validation suite.
- Push final GitHub commit.
- Deploy final Cloudflare build.
- Submit Apple and Google builds.
- Keep rollback plan ready.
