# Project Handoff

Use this file when starting a new conversation so work can continue with the same context and priorities.

## Repo
- Path: `c:\Users\spong\Desktop\kitchensoftware`
- Stack:
  - SvelteKit
  - Cloudflare Pages / Workers
  - Cloudflare D1
  - Cloudflare R2
- Shell/environment:
  - `powershell`
  - timezone: `America/Denver`

## Working Style
- Production is usually the goal.
- Local-only work is mainly for:
  - prototype passes
  - risky schedule logic
  - debugging
- Preferred workflow when a feature is ready:
  1. validate locally
  2. push to git
  3. apply live DB migration if needed
  4. verify production

## User Preferences
- Keep changes methodical and exact.
- Prefer small passes, not giant rewrites.
- Avoid speculative behavior changes.
- Match the existing app theme and UI language.
- The user dislikes redundant descriptive/helper copy in the UI.
- The user often wants very specific button flow and exact wording.
- If behavior is requested exactly, implement it exactly.

## Current High-Level Status
- The app is actively used in production.
- Email/invite flow is working live.
- Password reset is working live.
- Schedule system foundation is live.
- Camera work is paused.
- temp node/gateway work is paused.
- Current main expansion area is the schedule feature.

## Important Live Features Already Landed

### Schedule Foundation
Live already:
- admin weekly schedule builder
- public `Schedule`
- `My Schedule`
- homepage `Today’s Shift`
- copy last week
- day totals
- tracked hours
- custom inline time picker
- `FOH / Sushi / Kitchen` role structure

Core files:
- `src/lib/server/schedules.ts`
- `src/lib/assets/schedule.ts`
- `src/lib/components/ui/ScheduleTimeSelect.svelte`
- `src/lib/components/ui/ScheduleWeekColumns.svelte`
- `src/lib/components/ui/ScheduleWeekBoard.svelte`
- `src/routes/admin/schedule/+page.server.ts`
- `src/routes/admin/schedule/+page.svelte`
- `src/routes/schedule/+page.server.ts`
- `src/routes/schedule/+page.svelte`
- `src/routes/my-schedule/+page.server.ts`
- `src/routes/my-schedule/+page.svelte`
- `migrations/0034_schedule.sql`

### Homepage / Polish
Live already:
- Japanese greeting without user name
- `Today’s Shift` on homepage card
- fish icon next to `Today’s Shift`
- `Employee Of The Day` card with fish SVG
- school-of-fish empty state on `My Schedule`
- no-shift homepage text: `Have a good day!`

Relevant files:
- `src/routes/+page.svelte`
- `src/routes/+page.server.ts`
- `src/lib/components/ui/SchoolOfFish.svelte`

### Recipes
Live already:
- alphabetical ordering
- persistent search from main recipe page into category pages
- search uses URL query `?q=...`
- cleaner category rendering

Relevant files:
- `src/routes/recipes/+page.svelte`
- `src/routes/recipes/+page.server.ts`
- `src/routes/recipes/[category]/+page.svelte`
- `src/routes/recipes/[category]/+page.server.ts`

### Splash / Favicon
Live already:
- splash styled with knife + onion chopping
- sushi-pattern background
- favicon aligned with splash visual language
- splash waits for real page load plus minimum display time

Relevant files:
- `src/app.html`
- `src/routes/+layout.svelte`
- `static/favicon-splash.svg`

### Email / Auth
Live already:
- Resend invite flow
- Cloudflare Email Routing support alias
- password reset flow

Relevant migrations already live:
- `migrations/0032_password_resets.sql`

## Database / Migration State

### Already Live
- `0032_password_resets.sql`
- `0034_schedule.sql`

### Local Only Right Now
- `0035_schedule_shift_offers.sql`

`0035_schedule_shift_offers.sql` creates:
- `schedule_shift_offers`
  - `id`
  - `shift_id`
  - `offered_by_user_id`
  - `requested_by_user_id`
  - `manager_note`
  - `created_at`
  - `updated_at`

File:
- `migrations/0035_schedule_shift_offers.sql`

## Current Local-Only Work

This is the most important unfinished context.

### Shift Offer Small Pass
Implemented locally, not pushed:
- employee can `Offer Shift` from `My Schedule`
- their offered shift shows `Up for grabs`
- they can `Cancel Offer`
- other employees can see those shifts in an `Open Shifts` list

Intentionally not in this pass:
- requesting a shift
- manager approval queue
- shift reassignment

Local files involved:
- `src/lib/server/schedules.ts`
- `src/routes/my-schedule/+page.server.ts`
- `src/routes/my-schedule/+page.svelte`
- `migrations/0035_schedule_shift_offers.sql`

This smaller pass was trimmed back from a larger unfinished pass to keep progress manageable.

### Important Note About `schedules.ts`
The server file may still contain helper functions from the larger pass, including:
- `requestScheduleShiftOffer`
- `withdrawScheduleShiftRequest`
- `approveScheduleShiftOffer`
- `declineScheduleShiftOffer`

Those may exist in code even though the smaller current UI does not use them yet.
Do not assume they are live or fully wired.

## Exact Schedule UX Rules Already Established

These were requested explicitly and should be preserved unless the user asks otherwise:

- Only one sidebar `Schedule` tab.
- `My Schedule` is not a sidebar tab.
- Homepage `Today’s Shift` is more prominent than announcements.
- Admin schedule is a weekly sheet:
  - employees down the left
  - days across the top
- Employees are added intentionally from the top-left selector.
- Shift creation flow must be:
  1. add employee row
  2. click `Add Shift`
  3. one large shift editor opens
  4. create the shift
  5. that same shift collapses into a summary card
  6. no extra editor appears unless `Add Shift` is clicked again
- End-of-shift supports:
  - timed end
  - `BD`
  - `Close`
- Time picker is custom:
  - embedded inline
  - hour control
  - minute control only `00 / 15 / 30 / 45`
  - `AM / PM`
  - inline `Cancel` and `OK`
  - themed to match the app
- Admin status labels should remain:
  - `Unsaved Draft`
  - `Saved Draft`
  - `Published Schedule`
- Week header format should remain like:
  - `04/06-12/26`

## Schedule Department / Role Structure

Departments:
- `FOH`
- `Sushi`
- `Kitchen`

Roles:

### FOH
- `Server`
- `Runner`
- `Host`
- `FOH MGR`

### Sushi
- `BOH MGR`
- `Roller`
- `Opener`
- `Sushi Prep`
- `Swing`

### Kitchen
- `BOH MGR`
- `Cook`
- `Dish`
- `Swing`

User wants detail/location strings to support things like:
- `Roller, 3 Bus, 3pm-BD`
- `Cook, 8am-BD`
- `Close`

## Current Recommended Next Passes

Do these in small slices:

1. push current `Offer Shift + Open Shifts` pass if the user approves
2. next small pass: `Request Shift`
3. next small pass: manager `Approve / Decline`
4. then continue toward more 7shifts-like usefulness

Avoid doing all of those together in one turn.

## If Shipping The Current Local Shift-Offer Pass

Run:

```powershell
git status --short
npm.cmd run check
npm.cmd run build
```

If all good:

```powershell
git add src/lib/server/schedules.ts src/routes/my-schedule/+page.server.ts src/routes/my-schedule/+page.svelte migrations/0035_schedule_shift_offers.sql
git commit -m "Add schedule shift offers"
git push
```

Then apply the live migration:

```powershell
npx.cmd wrangler d1 execute kitchen --remote --file migrations/0035_schedule_shift_offers.sql
```

Then verify:

```powershell
npx.cmd wrangler d1 execute kitchen --remote --command "PRAGMA table_info(schedule_shift_offers);"
```

## Useful Commands

```powershell
git status --short
npm.cmd run check
npm.cmd run build
```

## Recommended First Prompt In A New Chat

Use something like:

> Continue from `docs/PROJECT_HANDOFF.md` in `c:\Users\spong\Desktop\kitchensoftware`. Start by reading that handoff and checking `git status --short`. Then help me continue the current local-only schedule shift-offer pass in small steps without doing a large rewrite.

