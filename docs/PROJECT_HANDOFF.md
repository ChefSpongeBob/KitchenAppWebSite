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

## Next Phase List

Work this list in order. Do not branch into unrelated polish unless a blocker appears.

1. Global app shell and UI
- Confirm marketing pages use top nav only.
- Confirm app pages use app/sidebar navigation only.
- Confirm admin controls only appear for admin/manager business roles.
- Confirm feature hiding removes normal app sidebar links.
- Confirm light mode, dark mode, status colors, buttons, empty states, and mobile layout are consistent.

2. Auth and account flows
- Confirm login, active-session Continue, Not you, logout, wrong password/email, forgot password, reset password, and account deletion.
- Confirm auth errors never become 500s.
- Confirm login rate limiting does not trap normal testing.

3. Signup, onboarding, trial, and billing placeholder
- Confirm `/register` is the only active signup slideshow path.
- Confirm old rejected onboarding paths are gone.
- Confirm employee invite onboarding skips pricing/trial slides.
- Confirm password validation keeps user-entered onboarding data.
- Confirm final welcome/transition page sends users to login.

4. Marketing pages
- Confirm homepage, features, how-it-works, pricing, about, privacy, badges, carousel, screenshots, and mobile layouts.
- Confirm marketing dark mode is gone.
- Confirm app preview buttons do not expose unsecured app pages.

5. App homepage
- Confirm business name, greeting, display name, announcements, highlights, ToDo, Menus, Temps, Conversions, and feature-gated sidebar behavior.

6. Admin dashboard and app editor
- Confirm summaries, reminders, staffed employees, feature matrix, business registry, business logo upload, business name save, and admin dropdown.

7. Creator, lists, checklists, prep, orders, inventory
- Confirm categories and items can be created, edited, deleted, saved, cleared, and immediately displayed.
- Confirm no hardcoded prep/order/inventory/checklist data remains.
- Confirm submit prep counts, checklist toggle, and checklist reset remain intact.

8. Documents, menus, and recipes
- Confirm document categories are admin-created only.
- Confirm menus are separate from docs and reflect on `/menu` plus homepage tile.
- Confirm recipes/categories create, edit, delete, and display correctly.

9. Scheduling
- Confirm schedule builder, roles, settings, draft, publish-without-draft, copy, duplicate, warnings, department permissions, manager approval, `/schedule`, and `/my-schedule`.

10. Users, invites, employee profiles, and onboarding
- Confirm invite emails/manual links, admin/manager role behavior, department structure, employee onboarding packet, mandatory completion, approvals, sensitive vault encryption, HR access, and audit rows.

11. Settings and profile
- Confirm profile, contact, birthday request, availability, app preferences, sessions/devices, password link, and onboarding tab.

12. Operations
- Confirm ToDo, announcements, highlights, whiteboard, temps, cameras, conversions, and specials.
- Whiteboard still needs a visual pass: thought cloud centering, dynamic text, smaller low-vote clouds, and no stray line.

13. API and backend audit
- Confirm every form action validates input.
- Confirm every admin action checks authority.
- Confirm every upload validates file type/size.
- Confirm every media response is private and scoped.
- Confirm every destructive action includes business ID.
- Confirm sensitive data is never returned to unauthorized roles.

14. Final manual local test
- Fresh workspace signup, owner login, registry/logo update, feature matrix, creator/list/docs/menu/recipe flows, invite, onboarding, schedule, ToDo, announcement, highlight, whiteboard, temp sensor test, camera test, logout/login/switch-account, and phone viewport.

15. Blocked until trademark/live site hold is lifted
- Production traffic reopening.
- Production schema readiness.
- Production smoke.
- Full live multi-business tenant separation.
- Live invite links.
- Production email deliverability.
- Real App Store / Google Play billing tests.
- Real production camera/sensor tests.
