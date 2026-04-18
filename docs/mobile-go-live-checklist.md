# Mobile Go-Live Checklist (Capacitor + iOS)

Use this as the release gate before shipping native installs.

## 1) Release Identity
- [ ] Confirm `capacitor.config.json` values:
  - `appId`
  - `appName`
  - `server.url`
  - platform debug flags (`loggingBehavior`, `webContentsDebuggingEnabled`)
- [ ] Bump app version/build numbers for iOS release.
- [ ] Confirm production API/domain routing.

## 2) Feature Flags
- [ ] Set `PUBLIC_CAMERA_BETA_ENABLED` for the target environment.
  - `true`/`1`: Camera feature is enabled (Beta).
  - `false`/`0`: Camera admin page and camera APIs are hidden/disabled.
- [ ] Verify camera visibility matches the target flag value.

## 3) Authentication + Session
- [ ] Login persists after app close/reopen.
- [ ] Logout revokes session/device correctly.
- [ ] Reset password flow works end-to-end on mobile.
- [ ] Inactive/disabled users are blocked as expected.

## 4) Data + Migrations
- [ ] Confirm migration tracking strategy is consistent for this environment (`d1_migrations`).
- [ ] Run all pending D1 migrations in production (or execute equivalent idempotent SQL if tracking is legacy/manual).
- [ ] Confirm schema parity between local/prod for:
  - schedules
  - profile data
  - camera tables (if enabled)
- [ ] Smoke test create/update/delete flows on production DB.

## 5) Critical Flow Smoke Test
- [ ] Admin schedule builder:
  - add/remove employee
  - create/edit shift
  - save draft
  - publish week
- [ ] Employee schedule view:
  - correct day cards
  - off-day fish display
- [ ] Profile flow:
  - personal/contact updates
  - birthday approval request
- [ ] Toast confirmations are consistent for all save actions.

## 6) Camera Beta Validation
- [ ] Verify clip ingestion endpoint auth and duplicate guard behavior.
- [ ] Verify R2 media links open and download.
- [ ] Verify admin camera page loads without blocking other admin pages.
- [ ] Confirm retention cleanup runs and old clips are removed.
- [ ] Confirm camera failures do not affect core app pages.

## 7) iOS Native Checks
- [ ] Set required iOS permission usage strings in `Info.plist`.
- [ ] Validate safe area/layout on at least:
  - iPhone standard size
  - iPhone Max size
- [ ] Test cold start/splash handoff to app shell.
- [ ] Test background/foreground resume behavior.

## 8) Performance + Reliability
- [ ] Verify no schedule-page freezes on add shift.
- [ ] Verify home/admin pages load within acceptable latency.
- [ ] Check logs for 500s during smoke tests.
- [ ] Confirm polling does not trigger duplicate request storms.

## 9) Distribution
- [ ] Archive and upload iOS build.
- [ ] Push TestFlight beta first.
- [ ] Run UAT checklist with managers.
- [ ] Promote same build to production after signoff.
