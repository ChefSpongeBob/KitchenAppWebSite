# Crimini

Crimini is a restaurant operations platform by NexusNorthSystems, LLC.

## Stack
- SvelteKit / TypeScript
- Cloudflare Pages
- Cloudflare D1
- Cloudflare R2
- Capacitor mobile shell prep

## Development
```powershell
npm.cmd run dev
npm.cmd run check
npm.cmd run build
```

## Cloudflare
Configured in `wrangler.jsonc`:
- Pages project: `criminikitchenapp`
- D1 binding: `DB` -> `crimini-production`
- R2 bindings: `DOC_MEDIA`, `CAMERA_MEDIA`
- `APP_BASE_URL=https://criminiops.com`

## Migrations
```powershell
npm.cmd run db:migrations:apply:local
npm.cmd run db:migrations:apply:remote
```

Do not run remote migration commands without explicit approval in chat.

## Validation
```powershell
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
- Schema readiness: `/api/internal/schema-readiness`
- Smoke session: `/api/internal/smoke/session`
- Required secret: `SMOKE_INTERNAL_TOKEN`
- Optional default user: `SMOKE_DEFAULT_EMAIL`

## Feature Flags
- `PUBLIC_CAMERA_BETA_ENABLED=1` enables camera ingest/activity beta routes.
- If unset, camera beta ingest routes return 404.
