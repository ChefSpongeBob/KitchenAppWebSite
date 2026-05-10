# Project Context

## Overview
Crimini is a multi-tenant restaurant operations platform built with SvelteKit and deployed on Cloudflare Pages. It includes marketing pages, signup/onboarding, business-scoped app data, admin tools, scheduling, lists, recipes, documents, menus, employee onboarding, temps/sensors, camera beta plumbing, billing placeholders, and tenant lifecycle controls.

## Stack
- Framework: SvelteKit / TypeScript
- Deployment: Cloudflare Pages with `@sveltejs/adapter-cloudflare`
- Database: Cloudflare D1 binding `DB`
- Media: Cloudflare R2 bindings `DOC_MEDIA` and `CAMERA_MEDIA`
- Mobile shell prep: Capacitor

## Current Public State
- `https://criminiops.com/` is intentionally showing a temporary `Coming soon.` visitor page.
- Direct app/admin/login routes remain available for controlled testing.

## Production Bindings
- D1 database: `crimini-production`
- R2 document bucket: `crimini-doc-media`
- R2 camera bucket: `crimini-camera-media`
- Base URL variable: `APP_BASE_URL=https://criminiops.com`

## Security Model
- Sessions are HTTP-only cookies.
- Admin authority is business-scoped through `business_users.role`.
- Tenant data is scoped by `business_id`.
- Media routes validate active business context before serving R2 objects.
- IoT ingest uses per-device credentials stored as hashes, not a shared API key.
- Internal smoke/schema endpoints require `SMOKE_INTERNAL_TOKEN`.

## Development Rules
- Keep changes surgical and validated.
- Do not run remote D1 commands unless explicitly approved.
- Avoid verbose UI copy.
- Preserve tenant isolation on every page/action/endpoint.
