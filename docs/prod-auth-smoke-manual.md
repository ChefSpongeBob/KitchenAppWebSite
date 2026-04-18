# Production Auth Smoke (Manual Browser Pass)

Use this when Cloudflare challenge blocks scripted login.

## Scope
- Environment: `https://nexusnorthsystems.com`
- Account: approved admin test user
- Device mix: desktop browser + one mobile browser

## Pass Steps
1. Open `/login` and sign in manually.
2. Confirm home dashboard loads with no error banner.
3. Open `/my-schedule` and verify the page renders (no 500, no blank state bug).
4. Open `/schedule` and verify team schedule loads.
5. Open `/settings` and save one safe field (for example display name), confirm success toast.
6. Open `/admin` and confirm admin tiles load.
7. Open `/admin/schedule` and verify:
   - page loads
   - add employee popup opens
   - add shift opens editor
   - create shift renders summary in employee/day grid
8. Publish flow sanity:
   - save draft
   - publish schedule
   - confirm success toast
9. Logout from UI and confirm redirect back to `/login`.
10. Forgot-password flow:
    - open `/forgot-password`
    - submit test email
    - confirm success response message (no 500/403 in browser path)

## Fail Conditions
- Any 500 on route load/action
- Any frozen schedule interaction
- Missing success toast after save/publish
- Redirect loop to login while authenticated

## Recordkeeping
- Capture date/time (America/Denver), route, and screenshot for each fail.
- Add findings to `docs/PROJECT_HANDOFF.md` before next deploy.
