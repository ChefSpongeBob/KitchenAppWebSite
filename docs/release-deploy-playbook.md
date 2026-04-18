# Release Deploy Playbook

Use this as the default runbook for pushing web + DB safely.

## 1) Pre-Deploy Gate
- Pull latest `main`.
- Run:
  - `npm run check`
  - `npm run build`
  - `npm run mobile:check`
- Confirm feature flags for this release:
  - `PUBLIC_CAMERA_BETA_ENABLED` (default should stay `false` until camera is approved).

## 2) Database Safety
- Validate production DB access:
  - `npx wrangler d1 execute kitchen --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`
- Normalize migration tracking if needed:
  - `npm run db:migrations:normalize:remote`
- Apply required migrations before deploy:
  - `npm run db:migrations:apply:remote`

## 3) Deploy
- Push code to `main`.
- Trigger production deploy (Cloudflare pipeline/worker deploy path).
- Confirm deployment version timestamp.

## 4) Post-Deploy Smoke (Production)
- Run:
  - `npm run smoke:prod`
- Auth:
  - Login/logout
  - Password reset link flow
- Scheduling:
  - Admin: add employee, create shift, save draft, publish
  - Employee: `my-schedule` loads and shift updates/offers work
- Profile:
  - Save personal/contact info
  - Submit birthday edit request
- Admin:
  - Dashboard opens
  - Camera route blocked when beta flag is `false`

## 5) Rollback Plan
- App rollback:
  - Re-deploy last known good commit from `main` history.
- Flag rollback:
  - Set `PUBLIC_CAMERA_BETA_ENABLED=false` immediately if camera issues appear.
- DB rollback:
  - Prefer forward-fix with idempotent SQL.
  - Avoid destructive rollback SQL on production unless explicitly approved and backed up.

## 6) Incident Notes
- Capture:
  - failing route/action
  - exact timestamp/timezone
  - commit hash currently live
  - DB commands applied
- Add findings to `docs/PROJECT_HANDOFF.md` if they affect future releases.
