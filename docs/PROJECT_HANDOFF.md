# Project Handoff

Use this file when a new chat needs to continue Crimini work without guessing.

## Repo
- Path: `c:\Users\spong\Desktop\SoftwareKitchenNNS`
- GitHub: `https://github.com/ChefSpongeBob/KitchenAppWebSite`
- Live domain: `https://criminiops.com`
- Stack: SvelteKit, Cloudflare Pages, Cloudflare D1, Cloudflare R2, Capacitor shell prep

## Current Public State
- The public homepage is intentionally in a temporary visitor hold state.
- `/` shows the full Crimini worded logo and `Coming soon.` while legal, copyright, store, and launch items are finished.
- App/admin/auth routes remain intact for direct testing.

## Brand
- Product name: Crimini
- Legal/footer identity: Crimini by NNS, LLC / NexusNorthSystems, LLC where appropriate
- Browser favicon: mushroom-only mark
- Install/PWA icon: full worded Crimini logo

## Cloudflare Resources
- Pages project: `criminikitchenapp`
- D1 binding: `DB`
- D1 database: `crimini-production`
- R2 bindings: `DOC_MEDIA`, `CAMERA_MEDIA`
- Required production domain base: `APP_BASE_URL=https://criminiops.com`

## Safety Rules
- Do not run remote database commands unless explicitly approved in chat.
- Do not rewrite large UI sections without a plan first.
- Keep UI copy short and useful. Avoid obvious helper text and verbose subtitles.
- Preserve tenant/business scoping on every page, action, upload, and endpoint.
- Admin authority comes from business membership role, not global user role.

## Core Architecture
- Auth/session guard: `src/hooks.server.ts`
- Permission mapping: `src/lib/server/permissions.ts`
- Tenant schema/readiness: `src/lib/server/tenant.ts`
- Business context: `src/lib/server/business.ts`
- Login/session flow: `src/routes/login/+page.server.ts`
- App feature gating: `src/lib/server/appFeatures.ts`, `src/lib/features/appFeatures.ts`
- Admin operations: `src/lib/server/admin.ts`
- Scheduling: `src/lib/server/schedules.ts`
- IoT device auth: `src/lib/server/iotIngest.ts`
- Media access: `src/routes/api/documents/media/[...key]/+server.ts`, `src/routes/api/camera/media/[...key]/+server.ts`

## Validation Commands
```powershell
npm.cmd run check
npm.cmd run build
node .\scripts\tenant-authority-check.mjs
node .\scripts\tenant-isolation-check.mjs
node .\scripts\iot-device-auth-check.mjs
node .\scripts\media-access-check.mjs
node .\scripts\production-schema-check.mjs
node .\scripts\scale-performance-check.mjs
node .\scripts\auth-abuse-check.mjs
node .\scripts\billing-lifecycle-check.mjs
node .\scripts\observability-check.mjs
```

## Production Smoke
- Preferred smoke auth route: `/api/internal/smoke/session`
- Schema readiness route: `/api/internal/schema-readiness`
- Both require `SMOKE_INTERNAL_TOKEN`.
- `SMOKE_DEFAULT_EMAIL` can choose the smoke account server-side.

## Current Cleanup Notes
- Old copied static guide files have been removed.
- Duplicate `/api/smoke-session` alias has been removed; scripts use the internal route.
- The service worker no longer caches `/files/`.
