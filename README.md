# Crimini

Crimini is a restaurant operations platform by NexusNorthSystems, LLC.

## Stack
- SvelteKit / TypeScript
- Cloudflare Pages
- Cloudflare D1
- Cloudflare R2
- Capacitor Android/iOS clients

## Project Status
- The single completion checklist, current cursor, launch blockers and validation needs are in `docs/PROJECT_HANDOFF.md`.
- `docs/DB_ROUTE_INVENTORY.md` is the database/routing reference, not a separate task list.
- Firmware setup instructions are in `firmware/arduino/README.md`.

## Development
```powershell
npm.cmd run dev
npm.cmd run check
npm.cmd run build
```

## Cloudflare
Configured in `wrangler.jsonc`:
- Pages project: `criminikitchenappwebsite`
- Wrangler app name: `criminikitchenapp`
- D1 binding: `DB` -> `crimini-production`
- R2 binding: `DOC_MEDIA` -> `crimini-doc-media`
- `APP_BASE_URL=https://criminiops.com`
- Controlled testing: `PUBLIC_SIGNUP_ENABLED=false` and approved `OWNER_SIGNUP_ALLOWLIST`.
- Operational access requires an authorized paid/test tenant membership; valid invitations do not create public signup access.

## Migrations
```powershell
npm.cmd run db:migrations:apply:local
npm.cmd run db:migrations:apply:remote
```

Remote writes require approved scope. Back up and rehearse needed migrations, deploy compatible code and verify migration state with the release. Do not run old seed/repair scripts as routine setup.

## Validation
```powershell
npm.cmd run test:static
npm.cmd run build:native
```

## Production Smoke
- Use `npm.cmd run schema:readiness:prod` and `npm.cmd run smoke:prod` against the explicit target deployment.
- Use the current internal token and real smoke credentials from ignored local configuration; never commit their values.
- Smoke and build success do not replace the checklist's multi-tenant, workflow, physical-device, provider and legal acceptance gates.
