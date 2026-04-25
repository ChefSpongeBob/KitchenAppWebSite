# Launch Separation Tracker

Use this file as the single source of truth for getting this project launched as a fully separate entity.

## Rules (Lock These In)
- Do not run remote DB commands unless explicitly approved in chat.
- Keep footer information unchanged.
- Prefer local-only testing until separation is complete.

## Current Goal
Ship this app as its own product (marketing + downloads + desktop admin) with no dependency on the original project resources.

## How Next Step Is Chosen
The next step is always the first unchecked item in **Today Critical Path**.

## Today Critical Path
- [ ] 1. Create new Cloudflare resource map (new Pages/Worker project name, new D1 name, new R2 name).
- [ ] 2. Update `wrangler.jsonc` bindings to the new resource names/IDs.
- [ ] 3. Create project-local env template (`.env.example` or `.dev.vars.example`) with only new keys.
- [ ] 4. Replace old domain/app origin references with new project domain placeholders.
- [ ] 5. Verify login + admin routes work on local only (`npm run dev` flow).
- [ ] 6. Validate download/marketing routes and desktop admin navigation.
- [ ] 7. Run launch smoke checklist and record pass/fail notes.

## Required Inputs From You
- New production domain:
- New Cloudflare Pages/Worker project name:
- New D1 database name + ID:
- New R2 bucket name:
- App identities (iOS bundle ID / Android package name):

## Notes / Decisions Log
- 2026-04-24: Goal confirmed: fully separate from original project; footer stays unchanged.

## Quick Status
- Overall status: `IN_PROGRESS`
- Next step: `1. Create new Cloudflare resource map`
