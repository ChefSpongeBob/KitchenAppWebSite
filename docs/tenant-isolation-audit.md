# Tenant Isolation Audit

Purpose: every business-owned read/write must use the active business context from `locals.businessId` or a verified membership/invite path.

## Status

| Area | Status | Notes |
| --- | --- | --- |
| Auth/session | Pass | Active business is selected through a verified membership and stored in `kitchen_active_business`. |
| Admin dashboard | Pass | Admin loads/actions use `requireBusinessId(locals)` and business-scoped helpers. |
| App homepage | Pass | Schedule, todos, announcements, spotlight, and feature access use active business context. |
| Users/invites/onboarding | Pass | Admin user, invite, employee profile, and onboarding helpers scope to business. |
| Schedule/admin schedule/my schedule | Pass | Schedule reads/writes carry `businessId`; user schedule views use active business. |
| Lists/prep lists/orders/inventory/checklists | Pass | Creator/list sections and list items are business-scoped. |
| Recipes | Pass | Recipe categories and recipe rows are business-scoped. |
| Docs/menus/media | Pass | Document/menu rows and document media are business-scoped. |
| Todos | Pass | Todo rows, assignments, and completion logs are business-scoped. |
| Whiteboard | Pass | Posts, review, and votes use active business context. |
| Announcements/spotlight | Pass | Reads now prefer `business_id` with legacy prefixed-ID fallback. |
| Temps/sensors | Pass with follow-up | Reads are session/business-scoped; ingest requires explicit business context. Device-specific credentials remain Phase 4. |
| Cameras/media/activity | Pass with follow-up | Media is private/business-authorized; uploads use business-scoped object keys. Device-specific credentials remain Phase 4. |
| Billing/trial/legal agreements | Pass | Billing, trial, and legal records are business-scoped. |

## Automated Guards

- `npm run test:tenant-authority`
- `npm run test:tenant-isolation`

## Follow-Up Items

- Phase 4 must replace the shared IoT API key with provisioned per-device keys.
- Phase 5 should extend media checks with signed URLs or short-lived access tokens if direct file links are needed outside authenticated app sessions.
- Phase 6 should move remaining runtime schema mutation into migrations before production freeze.
