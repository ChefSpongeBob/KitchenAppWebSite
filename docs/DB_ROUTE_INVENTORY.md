# Crimini DB And Route Inventory

Generated: 2026-06-30T00:00:00.000Z

This file is the working map for DB table names, column names, and the code paths that reference them. It is intentionally schema-first so future DB calls use actual column names instead of guessed names.

## Summary

- Tables inventoried: 96
- Route/server files inventoried: 171
- Source files with direct DB table references: 126
- Tables with `business_id`: 80
- Tables with approved alternate tenant columns: 2
- Approved global/system/root tables: 14
- Tables with `user_id`: 33

## Inventory Caveats

- Static scans can mark table names mentioned in UI copy or validation files as `reference`; always inspect the listed file before editing logic.
- The authoritative table/column list is from the current migrated local D1 schema, which should match remote after migrations are applied.
- Cloudflare internal local metadata tables such as `_cf_METADATA` are intentionally excluded.

## Schema Assumption Mismatches To Fix Carefully

These are not runtime failures by themselves, but they are exactly the kind of mismatch that can cause bad assumptions later.

- None found

## Tenant Scope Anchors

Use these column names exactly when scoping business data:

- `account_audit_logs.business_id`
- `admin_reminders.business_id`
- `announcement_editors.business_id`
- `announcements.business_id`
- `app_feature_flags_business.business_id`
- `business_invites.business_id`
- `business_lifecycle_snapshots.business_id`
- `business_store_entitlements.business_id`
- `business_trials.business_id`
- `business_users.business_id`
- `camera_events.business_id`
- `camera_sources.business_id`
- `checklist_items.business_id`
- `checklist_sections.business_id`
- `creator_category_registry.business_id`
- `daily_specials.business_id`
- `daily_specials_editors.business_id`
- `documents.business_id`
- `employee_certifications.business_id`
- `employee_compliance_documents.business_id`
- `employee_compliance_requirements.business_id`
- `employee_document_access_audit.business_id`
- `employee_employment_records.business_id`
- `employee_onboarding_invite_requirements.business_id`
- `employee_onboarding_items.business_id`
- `employee_onboarding_packages.business_id`
- `employee_onboarding_template_items.business_id`
- `employee_pos_permissions.business_id`
- `employee_profile_edit_requests.business_id`
- `employee_profiles.business_id`
- `employee_role_permissions.business_id`
- `employee_sensitive_record_audit.business_id`
- `employee_sensitive_record_vault.business_id`
- `employee_spotlight.business_id`
- `employee_verification_checks.business_id`
- `iot_devices.business_id`
- `item_attachments.business_id`
- `legal_agreements.business_id`
- `list_item_activity_events.business_id`
- `list_items.business_id`
- `list_sections.business_id`
- `list_submission_batches.business_id`
- `list_submission_items.business_id`
- `operational_event_delivery_attempts.business_id`
- `operational_events.business_id`
- `push_notification_devices.business_id`
- `recipes.business_id`
- `schedule_departments.business_id`
- `schedule_labor_targets.business_id`
- `schedule_open_shift_requests.business_id`
- `schedule_open_shifts.business_id`
- `schedule_preferences.business_id`
- `schedule_publish_history.business_id`
- `schedule_role_definitions.business_id`
- `schedule_shift_history.business_id`
- `schedule_shift_offers.business_id`
- `schedule_shifts.business_id`
- `schedule_template_shifts.business_id`
- `schedule_templates.business_id`
- `schedule_week_team.business_id`
- `schedule_weeks.business_id`
- `sensor_nodes.business_id`
- `store_billing_placeholders.business_id`
- `store_purchase_events.business_id`
- `temperature_alert_events.business_id`
- `temperature_sensor_nodes.business_id`
- `temperature_sensor_settings.business_id`
- `temps.business_id`
- `todo_assignments.business_id`
- `todo_completion_log.business_id`
- `todos.business_id`
- `trial_identity_claims.business_id`
- `user_schedule_availability.business_id`
- `user_schedule_departments.business_id`
- `user_schedule_time_off_requests.business_id`
- `vendor_resources.business_id`
- `waste_logs.business_id`
- `whiteboard_posts.business_id`
- `whiteboard_review.business_id`
- `whiteboard_votes.business_id`

Tables that are user-linked but not necessarily business-scoped:

- `devices.user_id`
- `password_resets.user_id`
- `sessions.user_id`
- `user_preferences.user_id`

Known nonstandard tenant columns:

- `account_deletion_requests.requester_business_id`
- `iot_device_inventory.claimed_business_id`

## Table Tenancy Classification

Validated by `npm.cmd run test:db-governance`.

- `tenant_data`: 80 tables with direct `business_id`, all listed in `src/lib/server/tenant.ts`.
- `alternate_tenant_column`: `account_deletion_requests.requester_business_id`, `iot_device_inventory.claimed_business_id`.
- `approved_global_system`: `app_feature_flags`, `businesses`, `d1_migrations`, `devices`, `iot_ingest_guard`, `password_resets`, `security_rate_limits`, `sessions`, `store_products`, `store_webhook_events`, `trial_denials`, `user_invites`, `user_preferences`, `users`.

Notes:

- `businesses` is the root tenant registry.
- `users` is global identity only; tenant authority must resolve through `business_users`.
- `user_invites` is legacy compatibility only; active restaurant onboarding/invite creation must use `business_invites`.

## Route Capability Gates

Defined in `src/lib/auth/routeCapabilities.ts` and enforced in `src/hooks.server.ts`.

- `/admin/users` -> `manage_people`
- `/admin/onboarding` -> `manage_onboarding`
- `/admin/schedule`, `/admin/schedule-roles`, `/admin/schedule-settings` -> `manage_schedule`
- `/admin/camera`, `/admin/sensors` -> `manage_devices`
- `/admin/vendors` -> `manage_vendors`
- `/admin/app-editor` -> `manage_workspace`
- `/admin/creator`, `/admin/category-creator`, `/admin/documents`, `/admin/lists`, `/admin/menus`, `/admin/recipes` -> `manage_content`
- `/reports` -> `view_reports`
- `/vendors` -> `view_vendors`
- `/billing` -> `manage_billing`
- `/admin` fallback -> `admin_access`

## Route To Table Usage

- `/` -> `src/routes/+layout.server.ts` -> `businesses` (reference), `user_preferences` (select)
- `/+layout.svelte` -> `src/routes/+layout.svelte` -> `announcements` (reference), `businesses` (reference), `recipes` (reference), `users` (reference)
- `/+page.svelte` -> `src/routes/+page.svelte` -> `announcements` (reference), `documents` (reference), `recipes` (reference)
- `/account-deletion` -> `src/routes/account-deletion/+page.server.ts` -> `account_deletion_requests` (insert)
- `/account-deletion/+page.svelte` -> `src/routes/account-deletion/+page.svelte` -> `users` (reference)
- `/admin` -> `src/routes/admin/+page.server.ts` -> `announcements` (reference), `business_users` (select), `employee_spotlight` (reference), `schedule_shifts` (select), `temps` (select), `todos` (select), `users` (select)
- `/admin/+page.svelte` -> `src/routes/admin/+page.svelte` -> `announcements` (reference), `employee_spotlight` (reference), `recipes` (reference), `temps` (reference), `todos` (reference), `users` (reference)
- `/admin/app-editor` -> `src/routes/admin/app-editor/+page.server.ts` -> `businesses` (select/update), `documents` (reference)
- `/admin/camera` -> `src/routes/admin/camera/+page.server.ts` -> `camera_events` (delete/select), `camera_sources` (select)
- `/admin/camera/setup` -> `src/routes/admin/camera/setup/+page.server.ts` -> `camera_sources` (insert)
- `/admin/creator` -> `src/routes/admin/creator/+page.server.ts` -> `documents` (reference), `recipes` (reference)
- `/admin/creator/+page.svelte` -> `src/routes/admin/creator/+page.svelte` -> `documents` (reference), `recipes` (reference)
- `/admin/onboarding` -> `src/routes/admin/onboarding/+page.server.ts` -> `users` (reference)
- `/admin/onboarding/+page.svelte` -> `src/routes/admin/onboarding/+page.svelte` -> `schedule_departments` (reference), `users` (reference)
- `/admin/schedule` -> `src/routes/admin/schedule/+page.server.ts` -> `users` (reference)
- `/admin/schedule/+page.svelte` -> `src/routes/admin/schedule/+page.svelte` -> `users` (reference)
- `/admin/users` -> `src/routes/admin/users/+page.server.ts` -> `users` (reference)
- `/admin/users/:id` -> `src/routes/admin/users/[id]/+page.server.ts` -> `users` (reference)
- `/admin/users/+page.svelte` -> `src/routes/admin/users/+page.svelte` -> `users` (reference)
- `/announcements` -> `src/routes/announcements/+page.server.ts` -> `announcements` (reference)
- `/announcements/+page.svelte` -> `src/routes/announcements/+page.svelte` -> `announcements` (reference)
- `/api/billing/app-store-notifications` -> `src/routes/api/billing/app-store-notifications/+server.ts` -> `store_webhook_events` (insert/update)
- `/api/billing/google-play-notifications` -> `src/routes/api/billing/google-play-notifications/+server.ts` -> `store_webhook_events` (insert/update)
- `/api/camera/activity` -> `src/routes/api/camera/activity/+server.ts` -> `camera_events` (insert)
- `/api/camera/media/*key` -> `src/routes/api/camera/media/[...key]/+server.ts` -> `businesses` (reference), `camera_events` (select)
- `/api/camera/upload` -> `src/routes/api/camera/upload/+server.ts` -> `businesses` (reference), `camera_events` (insert)
- `/api/documents/media/*key` -> `src/routes/api/documents/media/[...key]/+server.ts` -> `businesses` (select), `documents` (select), `employee_onboarding_items` (select), `employee_onboarding_template_items` (select)
- `/api/internal/schema-readiness` -> `src/routes/api/internal/schema-readiness/+server.ts` -> `account_audit_logs` (reference), `account_deletion_requests` (reference), `business_invites` (reference), `business_lifecycle_snapshots` (reference), `business_users` (reference), `businesses` (reference), `devices` (reference), `employee_certifications` (reference), `employee_compliance_documents` (reference), `employee_compliance_requirements` (reference), `employee_document_access_audit` (reference), `employee_employment_records` (reference), `employee_onboarding_invite_requirements` (reference), `employee_onboarding_items` (reference), `employee_onboarding_packages` (reference), `employee_onboarding_template_items` (reference), `employee_pos_permissions` (reference), `employee_role_permissions` (reference), `employee_sensitive_record_audit` (reference), `employee_sensitive_record_vault` (reference), `employee_verification_checks` (reference), `iot_device_inventory` (reference), `operational_event_delivery_attempts` (reference), `operational_events` (reference), `password_resets` (reference), `push_notification_devices` (reference), `security_rate_limits` (reference), `sessions` (reference), `store_products` (reference), `store_webhook_events` (reference), `temperature_alert_events` (reference), `temperature_sensor_nodes` (reference), `temperature_sensor_settings` (reference), `trial_identity_claims` (reference), `user_preferences` (reference), `users` (reference), `waste_logs` (reference)
- `/api/internal/smoke/session` -> `src/routes/api/internal/smoke/session/+server.ts` -> `devices` (insert/select), `sessions` (insert/update), `users` (select)
- `/api/temps` -> `src/routes/api/temps/+server.ts` -> `temps` (insert/select)
- `/api/whiteboard` -> `src/routes/api/whiteboard/+server.ts` -> `users` (reference), `whiteboard_posts` (insert/select/update), `whiteboard_review` (insert/select), `whiteboard_votes` (insert/select)
- `/app` -> `src/routes/app/+page.server.ts` -> `announcements` (reference), `daily_specials` (reference), `documents` (select), `employee_spotlight` (reference), `sensor_nodes` (select), `temps` (select), `todo_assignments` (select), `todos` (select), `users` (select), `whiteboard_posts` (select), `whiteboard_review` (select)
- `/app/+page.svelte` -> `src/routes/app/+page.svelte` -> `announcements` (reference), `daily_specials` (reference), `employee_spotlight` (reference), `temps` (reference), `todos` (reference)
- `/app/about` -> `src/routes/app/about/+page.server.ts` -> `documents` (select)
- `/billing` -> `src/routes/billing/+page.server.ts` -> `businesses` (select), `users` (select)
- `/docs` -> `src/routes/docs/+page.server.ts` -> `documents` (select)
- `/docs/:slug` -> `src/routes/docs/[slug]/+page.server.ts` -> `documents` (select)
- `/docs/:slug/+page.svelte` -> `src/routes/docs/[slug]/+page.svelte` -> `documents` (reference)
- `/docs/+page.svelte` -> `src/routes/docs/+page.svelte` -> `documents` (reference)
- `/features/+page.svelte` -> `src/routes/features/+page.svelte` -> `announcements` (reference), `documents` (reference), `recipes` (reference), `users` (reference)
- `/how-it-works/+page.svelte` -> `src/routes/how-it-works/+page.svelte` -> `announcements` (reference), `documents` (reference), `recipes` (reference), `users` (reference)
- `/lists/checklists` -> `src/routes/lists/checklists/+page.server.ts` -> `checklist_sections` (select)
- `/lists/inventory` -> `src/routes/lists/inventory/+page.server.ts` -> `list_sections` (select)
- `/lists/orders` -> `src/routes/lists/orders/+page.server.ts` -> `list_sections` (select)
- `/lists/preplists` -> `src/routes/lists/preplists/+page.server.ts` -> `list_sections` (select)
- `/login` -> `src/routes/login/+page.server.ts` -> `business_users` (select), `devices` (insert/select/update), `sessions` (insert/update), `users` (select/update)
- `/logout` -> `src/routes/logout/+page.server.ts` -> `sessions` (update)
- `/menu` -> `src/routes/menu/+page.server.ts` -> `documents` (select)
- `/pricing/+page.svelte` -> `src/routes/pricing/+page.svelte` -> `announcements` (reference), `recipes` (reference), `users` (reference)
- `/privacy/+page.svelte` -> `src/routes/privacy/+page.svelte` -> `sessions` (reference), `users` (reference)
- `/recipes` -> `src/routes/recipes/+page.server.ts` -> `recipes` (select)
- `/recipes/:category` -> `src/routes/recipes/[category]/+page.server.ts` -> `recipes` (select)
- `/recipes/:category/+page.svelte` -> `src/routes/recipes/[category]/+page.svelte` -> `recipes` (reference)
- `/recipes/+page.svelte` -> `src/routes/recipes/+page.svelte` -> `recipes` (reference)
- `/register` -> `src/routes/register/+page.server.ts` -> `business_invites` (select/update), `business_users` (insert/select), `businesses` (insert/select), `devices` (insert), `employee_employment_records` (insert), `employee_profiles` (insert), `sessions` (insert), `user_invites` (select/update), `user_preferences` (insert), `user_schedule_departments` (insert), `users` (insert/select)
- `/register/+page.svelte` -> `src/routes/register/+page.svelte` -> `recipes` (reference), `users` (reference)
- `/reset-password/:token` -> `src/routes/reset-password/[token]/+page.server.ts` -> `password_resets` (update), `users` (update)
- `/settings` -> `src/routes/settings/+page.server.ts` -> `employee_profile_edit_requests` (insert/update), `employee_profiles` (insert), `sessions` (reference), `user_preferences` (insert/select), `users` (select/update)
- `/settings/+page.svelte` -> `src/routes/settings/+page.svelte` -> `sessions` (reference)
- `/specials` -> `src/routes/specials/+page.server.ts` -> `daily_specials` (insert)
- `/temper` -> `src/routes/temper/+page.server.ts` -> `sensor_nodes` (select)
- `/temper/+page.svelte` -> `src/routes/temper/+page.svelte` -> `temps` (reference)
- `/terms/+page.svelte` -> `src/routes/terms/+page.svelte` -> `businesses` (reference), `documents` (reference), `users` (reference)
- `/todo` -> `src/routes/todo/+page.server.ts` -> `todo_assignments` (select), `todo_completion_log` (insert), `todos` (delete/select/update), `users` (select)
- `/todo/log` -> `src/routes/todo/log/+page.server.ts` -> `todo_completion_log` (delete/select), `users` (select)
- `/tools/waste` -> `src/routes/tools/waste/+page.server.ts` -> `users` (select), `waste_logs` (insert/select)

## Dynamic Or Runtime Schema SQL Watchlist

These files use dynamic SQL, PRAGMA, ALTER, CREATE INDEX/TABLE, or schema repair logic. They should be handled carefully before production changes.

- `scripts/ensure-tenant-columns.mjs`
- `scripts/iot-device-auth-check.mjs`
- `scripts/native-push-check.mjs`
- `scripts/normalize-d1-migrations.mjs`
- `scripts/operational-events-check.mjs`
- `scripts/temperature-monitoring-check.mjs`
- `src/lib/server/admin.ts`
- `src/lib/server/announcements.ts`
- `src/lib/server/appFeatures.ts`
- `src/lib/server/business.ts`
- `src/lib/server/camera.ts`
- `src/lib/server/dailySpecials.ts`
- `src/lib/server/dbSchema.ts`
- `src/lib/server/employeeSpotlight.ts`
- `src/lib/server/history.ts`
- `src/lib/server/iotIngest.ts`
- `src/lib/server/itemAttachments.ts`
- `src/lib/server/legal.ts`
- `src/lib/server/operationalEvents.ts`
- `src/lib/server/passwordReset.ts`
- `src/lib/server/preplist.ts`
- `src/lib/server/pushNotifications.ts`
- `src/lib/server/schedules.ts`
- `src/lib/server/security.ts`
- `src/lib/server/storeBilling.ts`
- `src/lib/server/temperatureDeviceProvisioning.ts`
- `src/lib/server/temperatureMonitoring.ts`
- `src/lib/server/tenant.ts`
- `src/lib/server/trial.ts`
- `src/lib/server/userPreferences.ts`
- `src/lib/server/vendors.ts`

## Tables With No Direct Source References

These may be migration-only, webhook-only, future feature tables, or referenced dynamically. Do not delete without tracing first.

- None found

## Unknown Table Name References Found In Source

- None found from static SQL scan

## Full Table Catalog

### account_audit_logs

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT
  - `actor_user_id` TEXT
  - `target_user_id` TEXT
  - `action` TEXT (NOT NULL)
  - `email_hash` TEXT
  - `ip_hash` TEXT
  - `user_agent_hash` TEXT
  - `metadata_json` TEXT (NOT NULL, DEFAULT '{}')
  - `created_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/auth-abuse-check.mjs` [reference]
  - `src/lib/server/security.ts` [ddl, insert]
  - `src/lib/server/trial.ts` [reference]

### account_deletion_requests

**Columns**
  - `id` TEXT (PK)
  - `email` TEXT (NOT NULL)
  - `workspace_name` TEXT
  - `request_scope` TEXT (NOT NULL, DEFAULT 'user')
  - `details` TEXT
  - `status` TEXT (NOT NULL, DEFAULT 'pending')
  - `requester_user_id` TEXT
  - `requester_business_id` TEXT
  - `ip_hash` TEXT
  - `user_agent_hash` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `reviewed_at` INTEGER
  - `reviewed_by` TEXT

**Code Usage**
  - `/account-deletion` `src/routes/account-deletion/+page.server.ts` [insert]
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/auth-abuse-check.mjs` [reference]
  - `scripts/cloudflare-readiness-check.mjs` [reference]
  - `scripts/legal-readiness-check.mjs` [reference]

### admin_reminders

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `content` TEXT (NOT NULL)
  - `created_by` TEXT
  - `updated_by` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### announcement_editors

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `granted_by` TEXT
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `src/lib/server/admin.ts` [delete, insert, select]
  - `src/lib/server/announcements.ts` [ddl, select]

### announcements

**Columns**
  - `id` TEXT (PK)
  - `content` TEXT (NOT NULL, DEFAULT '')
  - `updated_by` TEXT
  - `updated_at` INTEGER (NOT NULL, DEFAULT 0)
  - `business_id` TEXT

**Code Usage**
  - `/+layout.svelte` `src/routes/+layout.svelte` [reference]
  - `/+page.svelte` `src/routes/+page.svelte` [reference]
  - `/admin/+page.svelte` `src/routes/admin/+page.svelte` [reference]
  - `/admin` `src/routes/admin/+page.server.ts` [reference]
  - `/announcements/+page.svelte` `src/routes/announcements/+page.svelte` [reference]
  - `/announcements` `src/routes/announcements/+page.server.ts` [reference]
  - `/app/+page.svelte` `src/routes/app/+page.svelte` [reference]
  - `/app` `src/routes/app/+page.server.ts` [reference]
  - `/features/+page.svelte` `src/routes/features/+page.svelte` [reference]
  - `/how-it-works/+page.svelte` `src/routes/how-it-works/+page.svelte` [reference]
  - `/pricing/+page.svelte` `src/routes/pricing/+page.svelte` [reference]
  - `scripts/core-feature-actions-check.mjs` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/tenant-isolation-check.mjs` [reference]
  - `src/lib/auth/roles.ts` [reference]
  - `src/lib/components/ui/Layout.svelte` [reference]
  - `src/lib/features/appFeatures.ts` [reference]
  - `src/lib/server/admin.ts` [reference]
  - `src/lib/server/announcements.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### app_feature_flags

**Columns**
  - `feature_key` TEXT (PK)
  - `mode` TEXT (NOT NULL, DEFAULT 'all')
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `src/lib/server/appFeatures.ts` [ddl, insert, select]

### app_feature_flags_business

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `feature_key` TEXT (NOT NULL)
  - `mode` TEXT (NOT NULL, DEFAULT 'all')
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/appFeatures.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### business_invites

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `email` TEXT (NOT NULL)
  - `email_normalized` TEXT (NOT NULL)
  - `invite_code` TEXT (NOT NULL)
  - `role` TEXT (NOT NULL, DEFAULT 'staff')
  - `invited_by` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `expires_at` INTEGER
  - `used_at` INTEGER
  - `used_by_user_id` TEXT
  - `revoked_at` INTEGER
  - `employment_type` TEXT (NOT NULL, DEFAULT 'employee')
  - `job_title` TEXT (NOT NULL, DEFAULT '')
  - `department` TEXT (NOT NULL, DEFAULT '')
  - `primary_schedule_department` TEXT (NOT NULL, DEFAULT '')
  - `start_date` TEXT (NOT NULL, DEFAULT '')
  - `pay_type` TEXT (NOT NULL, DEFAULT '')
  - `manager_user_id` TEXT
  - `onboarding_required` INTEGER (NOT NULL, DEFAULT 1)
  - `permission_template` TEXT (NOT NULL, DEFAULT 'staff')
  - `schedule_departments_json` TEXT (NOT NULL, DEFAULT '[]')

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/register` `src/routes/register/+page.server.ts` [select, update]
  - `src/lib/server/admin.ts` [insert, select, update]
  - `src/lib/server/business.ts` [ddl]

### business_lifecycle_snapshots

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT
  - `requested_by_user_id` TEXT
  - `reason` TEXT (NOT NULL)
  - `status` TEXT (NOT NULL, DEFAULT 'completed')
  - `table_counts_json` TEXT (NOT NULL)
  - `business_json` TEXT
  - `trial_json` TEXT
  - `billing_json` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `completed_at` INTEGER
  - `notes` TEXT

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/billing-lifecycle-check.mjs` [reference]
  - `src/lib/server/trial.ts` [ddl, insert]

### business_store_entitlements

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `owner_user_id` TEXT (NOT NULL)
  - `store` TEXT (NOT NULL)
  - `product_id` TEXT (NOT NULL)
  - `entitlement_key` TEXT (NOT NULL)
  - `plan_tier` TEXT
  - `addon_temp_monitoring` INTEGER (NOT NULL, DEFAULT 0)
  - `addon_camera_monitoring` INTEGER (NOT NULL, DEFAULT 0)
  - `purchase_token_hash` TEXT
  - `original_transaction_id` TEXT
  - `latest_transaction_id` TEXT
  - `status` TEXT (NOT NULL, DEFAULT 'pending_verification')
  - `current_period_start` INTEGER
  - `current_period_end` INTEGER
  - `auto_renewing` INTEGER (NOT NULL, DEFAULT 0)
  - `verified_at` INTEGER
  - `expires_at` INTEGER
  - `raw_payload_json` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/billing-lifecycle-check.mjs` [reference]
  - `src/lib/server/storeBilling.ts` [insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### business_trials

**Columns**
  - `business_id` TEXT (PK)
  - `owner_user_id` TEXT
  - `status` TEXT (NOT NULL, DEFAULT 'trialing')
  - `trial_started_at` INTEGER (NOT NULL)
  - `trial_ends_at` INTEGER (NOT NULL)
  - `converted_at` INTEGER
  - `canceled_at` INTEGER
  - `denial_reason` TEXT
  - `cancellation_reason` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/storeBilling.ts` [update]
  - `src/lib/server/tenant.ts` [reference]
  - `src/lib/server/trial.ts` [ddl, insert, select, update]

### business_users

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `role` TEXT (NOT NULL, DEFAULT 'staff')
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `permission_template` TEXT (NOT NULL, DEFAULT 'staff')

**Code Usage**
  - `/admin` `src/routes/admin/+page.server.ts` [select]
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/login` `src/routes/login/+page.server.ts` [select]
  - `/register` `src/routes/register/+page.server.ts` [insert, select]
  - `src/lib/server/admin.ts` [delete, select, update]
  - `src/lib/server/business.ts` [ddl, insert, select]
  - `src/lib/server/operationalEvents.ts` [select]
  - `src/lib/server/schedules.ts` [select]
  - `src/lib/server/trial.ts` [select]

### businesses

**Columns**
  - `id` TEXT (PK)
  - `name` TEXT (NOT NULL)
  - `slug` TEXT (NOT NULL)
  - `plan_tier` TEXT (NOT NULL, DEFAULT 'starter')
  - `status` TEXT (NOT NULL, DEFAULT 'active')
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `onboarding_completed_at` INTEGER
  - `onboarding_schedule_template` TEXT
  - `sidebar_logo_url` TEXT
  - `legal_business_name` TEXT
  - `registry_id` TEXT
  - `contact_email` TEXT
  - `contact_phone` TEXT
  - `website_url` TEXT
  - `address_line_1` TEXT
  - `address_line_2` TEXT
  - `address_city` TEXT
  - `address_state` TEXT
  - `address_postal_code` TEXT
  - `address_country` TEXT
  - `addon_temp_monitoring` INTEGER (NOT NULL, DEFAULT 0)
  - `addon_camera_monitoring` INTEGER (NOT NULL, DEFAULT 0)

**Code Usage**
  - `/+layout.svelte` `src/routes/+layout.svelte` [reference]
  - `/` `src/routes/+layout.server.ts` [reference]
  - `/admin/app-editor` `src/routes/admin/app-editor/+page.server.ts` [select, update]
  - `/api/camera/media/*key` `src/routes/api/camera/media/[...key]/+server.ts` [reference]
  - `/api/camera/upload` `src/routes/api/camera/upload/+server.ts` [reference]
  - `/api/documents/media/*key` `src/routes/api/documents/media/[...key]/+server.ts` [select]
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/billing` `src/routes/billing/+page.server.ts` [select]
  - `/register` `src/routes/register/+page.server.ts` [insert, select]
  - `/terms/+page.svelte` `src/routes/terms/+page.svelte` [reference]
  - `scripts/media-access-check.mjs` [reference]
  - `scripts/tenant-isolation-check.mjs` [reference]
  - `src/lib/server/admin.ts` [select]
  - `src/lib/server/announcements.ts` [reference]
  - `src/lib/server/appFeatures.ts` [reference]
  - `src/lib/server/business.ts` [ddl, insert, select]
  - `src/lib/server/dailySpecials.ts` [reference]
  - `src/lib/server/iotIngest.ts` [reference]
  - `src/lib/server/itemAttachments.ts` [reference]
  - `src/lib/server/storeBilling.ts` [update]
  - `src/lib/server/temperatureDeviceProvisioning.ts` [reference]
  - `src/lib/server/tenant.ts` [select]
  - `src/lib/server/trial.ts` [delete, select, update]
  - `src/lib/server/vendors.ts` [reference]

### camera_events

**Columns**
  - `id` TEXT (PK)
  - `camera_id` TEXT
  - `camera_name` TEXT
  - `event_type` TEXT
  - `payload_json` TEXT
  - `image_url` TEXT
  - `clip_url` TEXT
  - `clip_duration_seconds` INTEGER
  - `created_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/admin/camera` `src/routes/admin/camera/+page.server.ts` [delete, select]
  - `/api/camera/activity` `src/routes/api/camera/activity/+server.ts` [insert]
  - `/api/camera/media/*key` `src/routes/api/camera/media/[...key]/+server.ts` [select]
  - `/api/camera/upload` `src/routes/api/camera/upload/+server.ts` [insert]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/scale-performance-check.mjs` [delete, select]
  - `src/lib/server/camera.ts` [ddl, delete, select]
  - `src/lib/server/tenant.ts` [reference]

### camera_sources

**Columns**
  - `id` TEXT (PK)
  - `camera_id` TEXT UNIQUE
  - `name` TEXT (NOT NULL)
  - `live_url` TEXT
  - `preview_image_url` TEXT
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/admin/camera/setup` `src/routes/admin/camera/setup/+page.server.ts` [insert]
  - `/admin/camera` `src/routes/admin/camera/+page.server.ts` [select]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/camera.ts` [ddl]
  - `src/lib/server/tenant.ts` [reference]

### checklist_items

**Columns**
  - `id` TEXT (PK)
  - `section_id` TEXT (NOT NULL)
  - `content` TEXT (NOT NULL)
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `is_checked` INTEGER (NOT NULL, DEFAULT 0)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select, update]
  - `src/lib/server/checklists.ts` [delete, insert, select, update]
  - `src/lib/server/history.ts` [reference]
  - `src/lib/server/itemAttachments.ts` [reference]
  - `src/lib/server/tenant.ts` [reference]

### checklist_sections

**Columns**
  - `id` TEXT (PK)
  - `slug` TEXT (NOT NULL)
  - `title` TEXT (NOT NULL)
  - `description` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/lists/checklists` `src/routes/lists/checklists/+page.server.ts` [select]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select, update]
  - `src/lib/server/checklists.ts` [select]
  - `src/lib/server/history.ts` [select]
  - `src/lib/server/tenant.ts` [reference]

### creator_category_registry

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT
  - `editor_type` TEXT (NOT NULL)
  - `category` TEXT (NOT NULL)
  - `created_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [ddl, delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### d1_migrations

**Columns**
  - `id` INTEGER (PK)
  - `name` TEXT UNIQUE
  - `applied_at` TIMESTAMP (NOT NULL, DEFAULT CURRENT_TIMESTAMP)

**Code Usage**
  - `scripts/normalize-d1-migrations.mjs` [insert, select]

### daily_specials

**Columns**
  - `category` TEXT (PK)
  - `content` TEXT (NOT NULL, DEFAULT '')
  - `updated_by` TEXT
  - `updated_at` INTEGER (NOT NULL, DEFAULT 0)
  - `business_id` TEXT

**Code Usage**
  - `/app/+page.svelte` `src/routes/app/+page.svelte` [reference]
  - `/app` `src/routes/app/+page.server.ts` [reference]
  - `/specials` `src/routes/specials/+page.server.ts` [insert]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/features/appFeatures.ts` [reference]
  - `src/lib/server/dailySpecials.ts` [ddl, select]
  - `src/lib/server/tenant.ts` [reference]

### daily_specials_editors

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `granted_by` TEXT
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select]
  - `src/lib/server/dailySpecials.ts` [ddl, select]
  - `src/lib/server/tenant.ts` [reference]

### devices

**Columns**
  - `id` TEXT (PK)
  - `user_id` TEXT (NOT NULL)
  - `pin_hash` TEXT (NOT NULL, DEFAULT '')
  - `name` TEXT
  - `platform` TEXT
  - `user_agent` TEXT
  - `last_ip` TEXT
  - `last_seen_at` INTEGER
  - `revoked_at` INTEGER
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/api/internal/smoke/session` `src/routes/api/internal/smoke/session/+server.ts` [insert, select]
  - `/login` `src/routes/login/+page.server.ts` [insert, select, update]
  - `/register` `src/routes/register/+page.server.ts` [insert]
  - `scripts/auth-abuse-check.mjs` [reference]
  - `scripts/malicious-user-hardening-check.mjs` [reference]
  - `scripts/native-push-check.mjs` [reference]
  - `src/hooks.server.ts` [select]
  - `src/lib/server/security.ts` [select, update]

### documents

**Columns**
  - `id` TEXT (PK)
  - `slug` TEXT (NOT NULL)
  - `title` TEXT (NOT NULL)
  - `section` TEXT (NOT NULL)
  - `category` TEXT (NOT NULL)
  - `content` TEXT
  - `file_url` TEXT
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/+page.svelte` `src/routes/+page.svelte` [reference]
  - `/admin/app-editor` `src/routes/admin/app-editor/+page.server.ts` [reference]
  - `/admin/creator/+page.svelte` `src/routes/admin/creator/+page.svelte` [reference]
  - `/admin/creator` `src/routes/admin/creator/+page.server.ts` [reference]
  - `/api/documents/media/*key` `src/routes/api/documents/media/[...key]/+server.ts` [select]
  - `/app/about` `src/routes/app/about/+page.server.ts` [select]
  - `/app` `src/routes/app/+page.server.ts` [select]
  - `/docs/+page.svelte` `src/routes/docs/+page.svelte` [reference]
  - `/docs/:slug/+page.svelte` `src/routes/docs/[slug]/+page.svelte` [reference]
  - `/docs/:slug` `src/routes/docs/[slug]/+page.server.ts` [select]
  - `/docs` `src/routes/docs/+page.server.ts` [select]
  - `/features/+page.svelte` `src/routes/features/+page.svelte` [reference]
  - `/how-it-works/+page.svelte` `src/routes/how-it-works/+page.svelte` [reference]
  - `/menu` `src/routes/menu/+page.server.ts` [select]
  - `/terms/+page.svelte` `src/routes/terms/+page.svelte` [reference]
  - `scripts/admin-consolidation-check.mjs` [reference]
  - `scripts/core-feature-actions-check.mjs` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/hr-onboarding-check.mjs` [reference]
  - `scripts/local-smoke-check.mjs` [reference]
  - `scripts/media-access-check.mjs` [reference]
  - `scripts/observability-check.mjs` [reference]
  - `scripts/prod-smoke-check.mjs` [reference]
  - `scripts/scale-performance-check.mjs` [reference]
  - `src/lib/assets/navigation.ts` [reference]
  - `src/lib/auth/routeCapabilities.ts` [reference]
  - `src/lib/features/appFeatures.ts` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select, update]
  - `src/lib/server/itemAttachments.ts` [select]
  - `src/lib/server/tenant.ts` [reference]

### employee_certifications

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `certification_type` TEXT (NOT NULL, DEFAULT 'general')
  - `title` TEXT (NOT NULL)
  - `issuer` TEXT (NOT NULL, DEFAULT '')
  - `certificate_number` TEXT (NOT NULL, DEFAULT '')
  - `file_url` TEXT (NOT NULL, DEFAULT '')
  - `file_name` TEXT (NOT NULL, DEFAULT '')
  - `issued_at` INTEGER
  - `expires_at` INTEGER
  - `status` TEXT (NOT NULL, DEFAULT 'pending')
  - `reviewed_at` INTEGER
  - `reviewed_by` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select]

### employee_compliance_documents

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `requirement_id` TEXT
  - `onboarding_item_id` TEXT
  - `document_type` TEXT (NOT NULL, DEFAULT 'general')
  - `status` TEXT (NOT NULL, DEFAULT 'pending')
  - `file_url` TEXT (NOT NULL, DEFAULT '')
  - `file_name` TEXT (NOT NULL, DEFAULT '')
  - `signed_name` TEXT (NOT NULL, DEFAULT '')
  - `submitted_at` INTEGER
  - `reviewed_at` INTEGER
  - `reviewed_by` TEXT
  - `expires_at` INTEGER
  - `retention_until` INTEGER
  - `locked_at` INTEGER
  - `notes` TEXT (NOT NULL, DEFAULT '')
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/cloudflare-readiness-check.mjs` [reference]
  - `src/lib/server/admin.ts` [insert]

### employee_compliance_requirements

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `requirement_key` TEXT (NOT NULL)
  - `title` TEXT (NOT NULL)
  - `category` TEXT (NOT NULL, DEFAULT 'general')
  - `applies_to_type` TEXT (NOT NULL, DEFAULT 'employee')
  - `is_required` INTEGER (NOT NULL, DEFAULT 1)
  - `requires_document` INTEGER (NOT NULL, DEFAULT 0)
  - `requires_signature` INTEGER (NOT NULL, DEFAULT 0)
  - `default_due_days` INTEGER
  - `renewal_interval_days` INTEGER
  - `retention_years` INTEGER
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `src/lib/server/admin.ts` [insert, select]

### employee_document_access_audit

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `document_id` TEXT
  - `actor_user_id` TEXT
  - `action` TEXT (NOT NULL)
  - `ip_hash` TEXT
  - `user_agent_hash` TEXT
  - `metadata_json` TEXT (NOT NULL, DEFAULT '{}')
  - `created_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `src/lib/server/admin.ts` [select]

### employee_employment_records

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `employment_status` TEXT (NOT NULL, DEFAULT 'onboarding')
  - `employment_type` TEXT (NOT NULL, DEFAULT 'employee')
  - `job_title` TEXT (NOT NULL, DEFAULT '')
  - `department` TEXT (NOT NULL, DEFAULT '')
  - `primary_schedule_department` TEXT (NOT NULL, DEFAULT '')
  - `hire_date` TEXT (NOT NULL, DEFAULT '')
  - `start_date` TEXT (NOT NULL, DEFAULT '')
  - `termination_date` TEXT (NOT NULL, DEFAULT '')
  - `pay_type` TEXT (NOT NULL, DEFAULT '')
  - `manager_user_id` TEXT
  - `onboarding_package_id` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/register` `src/routes/register/+page.server.ts` [insert]
  - `scripts/hr-onboarding-check.mjs` [insert]
  - `src/lib/server/admin.ts` [insert, select, update]

### employee_onboarding_invite_requirements

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `invite_id` TEXT (NOT NULL)
  - `requirement_id` TEXT (NOT NULL)
  - `created_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `src/lib/server/admin.ts` [insert]

### employee_onboarding_items

**Columns**
  - `id` TEXT (PK)
  - `package_id` TEXT (NOT NULL)
  - `business_id` TEXT (NOT NULL, DEFAULT '')
  - `user_id` TEXT (NOT NULL)
  - `item_type` TEXT (NOT NULL, DEFAULT 'acknowledgement')
  - `title` TEXT (NOT NULL)
  - `description` TEXT (NOT NULL, DEFAULT '')
  - `status` TEXT (NOT NULL, DEFAULT 'pending')
  - `file_url` TEXT (NOT NULL, DEFAULT '')
  - `file_name` TEXT (NOT NULL, DEFAULT '')
  - `signed_name` TEXT (NOT NULL, DEFAULT '')
  - `manager_note` TEXT (NOT NULL, DEFAULT '')
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `created_at` INTEGER (NOT NULL)
  - `submitted_at` INTEGER
  - `reviewed_at` INTEGER
  - `reviewed_by` TEXT
  - `source_file_url` TEXT (NOT NULL, DEFAULT '')
  - `source_file_name` TEXT (NOT NULL, DEFAULT '')
  - `form_key` TEXT (NOT NULL, DEFAULT '')
  - `form_payload` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `/api/documents/media/*key` `src/routes/api/documents/media/[...key]/+server.ts` [select]
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/hr-onboarding-check.mjs` [reference]
  - `src/lib/server/admin.ts` [ddl, insert, select, update]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/tenant.ts` [reference]

### employee_onboarding_packages

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL, DEFAULT '')
  - `user_id` TEXT (NOT NULL)
  - `status` TEXT (NOT NULL, DEFAULT 'sent')
  - `payroll_classification` TEXT (NOT NULL, DEFAULT 'employee')
  - `sent_at` INTEGER (NOT NULL)
  - `completed_at` INTEGER
  - `approved_at` INTEGER
  - `approved_by` TEXT
  - `created_by` TEXT
  - `updated_at` INTEGER (NOT NULL)
  - `manager_note` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/hr-onboarding-check.mjs` [reference]
  - `src/lib/server/admin.ts` [ddl, insert, select, update]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/tenant.ts` [reference]

### employee_onboarding_template_items

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL, DEFAULT '')
  - `item_type` TEXT (NOT NULL, DEFAULT 'acknowledgement')
  - `title` TEXT (NOT NULL)
  - `description` TEXT (NOT NULL, DEFAULT '')
  - `source_file_url` TEXT (NOT NULL, DEFAULT '')
  - `source_file_name` TEXT (NOT NULL, DEFAULT '')
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `created_by` TEXT
  - `form_key` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `/api/documents/media/*key` `src/routes/api/documents/media/[...key]/+server.ts` [select]
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/hr-onboarding-check.mjs` [reference]
  - `src/lib/server/admin.ts` [ddl, delete, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### employee_pos_permissions

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `pos_external_id` TEXT (NOT NULL, DEFAULT '')
  - `can_clock_in` INTEGER (NOT NULL, DEFAULT 1)
  - `can_use_pos` INTEGER (NOT NULL, DEFAULT 0)
  - `can_open_cash_drawer` INTEGER (NOT NULL, DEFAULT 0)
  - `can_refund` INTEGER (NOT NULL, DEFAULT 0)
  - `can_void` INTEGER (NOT NULL, DEFAULT 0)
  - `can_manager_override` INTEGER (NOT NULL, DEFAULT 0)
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `src/lib/server/admin.ts` [insert, select]

### employee_profile_edit_requests

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL, DEFAULT '')
  - `user_id` TEXT (NOT NULL)
  - `requested_real_name` TEXT (NOT NULL, DEFAULT '')
  - `requested_birthday` TEXT (NOT NULL, DEFAULT '')
  - `status` TEXT (NOT NULL, DEFAULT 'pending')
  - `manager_note` TEXT (NOT NULL, DEFAULT '')
  - `requested_at` INTEGER (NOT NULL)
  - `resolved_at` INTEGER
  - `resolved_by` TEXT

**Code Usage**
  - `/settings` `src/routes/settings/+page.server.ts` [insert, update]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [ddl, select]
  - `src/lib/server/tenant.ts` [reference]

### employee_profiles

**Columns**
  - `business_id` TEXT (NOT NULL, DEFAULT '')
  - `user_id` TEXT (NOT NULL)
  - `real_name` TEXT (NOT NULL, DEFAULT '')
  - `phone` TEXT (NOT NULL, DEFAULT '')
  - `birthday` TEXT (NOT NULL, DEFAULT '')
  - `address_line_1` TEXT (NOT NULL, DEFAULT '')
  - `address_line_2` TEXT (NOT NULL, DEFAULT '')
  - `city` TEXT (NOT NULL, DEFAULT '')
  - `state` TEXT (NOT NULL, DEFAULT '')
  - `postal_code` TEXT (NOT NULL, DEFAULT '')
  - `emergency_contact_name` TEXT (NOT NULL, DEFAULT '')
  - `emergency_contact_phone` TEXT (NOT NULL, DEFAULT '')
  - `emergency_contact_relationship` TEXT (NOT NULL, DEFAULT '')
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `/register` `src/routes/register/+page.server.ts` [insert]
  - `/settings` `src/routes/settings/+page.server.ts` [insert]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### employee_role_permissions

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `permission_key` TEXT (NOT NULL)
  - `is_enabled` INTEGER (NOT NULL, DEFAULT 0)
  - `granted_by` TEXT
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select]
  - `src/lib/server/business.ts` [select]
  - `src/lib/server/operationalEvents.ts` [select]
  - `src/lib/server/sensitive.ts` [select]

### employee_sensitive_record_audit

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `vault_record_id` TEXT
  - `actor_user_id` TEXT
  - `action` TEXT (NOT NULL)
  - `ip_hash` TEXT
  - `user_agent_hash` TEXT
  - `metadata_json` TEXT (NOT NULL, DEFAULT '{}')
  - `created_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/hr-onboarding-check.mjs` [reference]
  - `src/lib/server/sensitive.ts` [insert]

### employee_sensitive_record_vault

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `record_scope` TEXT (NOT NULL)
  - `record_type` TEXT (NOT NULL)
  - `status` TEXT (NOT NULL, DEFAULT 'empty')
  - `encrypted_payload` TEXT (NOT NULL, DEFAULT '')
  - `payload_iv` TEXT (NOT NULL, DEFAULT '')
  - `payload_tag` TEXT (NOT NULL, DEFAULT '')
  - `key_version` TEXT (NOT NULL, DEFAULT '')
  - `encryption_algorithm` TEXT (NOT NULL, DEFAULT '')
  - `provider_reference` TEXT (NOT NULL, DEFAULT '')
  - `display_last_four` TEXT (NOT NULL, DEFAULT '')
  - `expires_at` INTEGER
  - `retention_until` INTEGER
  - `locked_at` INTEGER
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/cloudflare-readiness-check.mjs` [reference]
  - `scripts/hr-onboarding-check.mjs` [reference]
  - `src/lib/server/admin.ts` [insert, select, update]

### employee_spotlight

**Columns**
  - `id` TEXT (PK)
  - `employee_name` TEXT (NOT NULL, DEFAULT '')
  - `shoutout` TEXT (NOT NULL, DEFAULT '')
  - `updated_by` TEXT
  - `updated_at` INTEGER (NOT NULL, DEFAULT 0)
  - `business_id` TEXT

**Code Usage**
  - `/admin/+page.svelte` `src/routes/admin/+page.svelte` [reference]
  - `/admin` `src/routes/admin/+page.server.ts` [reference]
  - `/app/+page.svelte` `src/routes/app/+page.svelte` [reference]
  - `/app` `src/routes/app/+page.server.ts` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/features/appFeatures.ts` [reference]
  - `src/lib/server/admin.ts` [insert]
  - `src/lib/server/employeeSpotlight.ts` [ddl, select]
  - `src/lib/server/tenant.ts` [reference]

### employee_verification_checks

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `check_type` TEXT (NOT NULL)
  - `status` TEXT (NOT NULL, DEFAULT 'pending')
  - `provider_reference` TEXT (NOT NULL, DEFAULT '')
  - `result_summary` TEXT (NOT NULL, DEFAULT '')
  - `requested_at` INTEGER
  - `completed_at` INTEGER
  - `reviewed_at` INTEGER
  - `reviewed_by` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `src/lib/server/admin.ts` [insert, select, update]

### iot_device_inventory

**Columns**
  - `serial` TEXT (PK)
  - `device_type` TEXT (NOT NULL)
  - `hardware_model` TEXT
  - `firmware_version` TEXT
  - `key_hash` TEXT
  - `key_prefix` TEXT
  - `claim_status` TEXT (NOT NULL, DEFAULT 'available')
  - `claimed_business_id` TEXT
  - `claimed_iot_device_id` TEXT
  - `claimed_at` INTEGER
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/iot-device-auth-check.mjs` [ddl]
  - `scripts/temperature-monitoring-check.mjs` [ddl]
  - `src/lib/server/temperatureDeviceProvisioning.ts` [ddl, select, update]

### iot_devices

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `device_type` TEXT (NOT NULL)
  - `external_device_id` TEXT (NOT NULL)
  - `display_name` TEXT (NOT NULL)
  - `key_hash` TEXT (NOT NULL)
  - `key_prefix` TEXT (NOT NULL)
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `last_seen_at` INTEGER
  - `revoked_at` INTEGER
  - `created_by` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/iot-device-auth-check.mjs` [ddl]
  - `src/lib/server/iotIngest.ts` [ddl, insert, select, update]
  - `src/lib/server/temperatureDeviceProvisioning.ts` [insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### iot_ingest_guard

**Columns**
  - `guard_key` TEXT (PK)
  - `last_seen_at` INTEGER (NOT NULL)
  - `expires_at` INTEGER (NOT NULL)

**Code Usage**
  - `src/lib/server/iotIngest.ts` [ddl, delete, insert, select]

### item_attachments

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `source_type` TEXT (NOT NULL)
  - `source_item_id` TEXT (NOT NULL)
  - `target_type` TEXT (NOT NULL)
  - `target_id` TEXT (NOT NULL)
  - `created_at` INTEGER (NOT NULL)
  - `created_by` TEXT

**Code Usage**
  - `src/lib/server/itemAttachments.ts` [ddl, delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### legal_agreements

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `agreement_key` TEXT (NOT NULL)
  - `agreement_version` TEXT (NOT NULL)
  - `accepted_at` INTEGER (NOT NULL)
  - `acceptance_source` TEXT (NOT NULL, DEFAULT 'register')
  - `ip_address` TEXT
  - `user_agent` TEXT
  - `created_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/legal.ts` [ddl, insert]
  - `src/lib/server/tenant.ts` [reference]

### list_item_activity_events

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `domain` TEXT (NOT NULL)
  - `section_id` TEXT (NOT NULL)
  - `item_id` TEXT (NOT NULL)
  - `item_name_snapshot` TEXT (NOT NULL)
  - `event_type` TEXT (NOT NULL)
  - `actor_user_id` TEXT
  - `occurred_at` INTEGER (NOT NULL)
  - `value_snapshot` TEXT

**Code Usage**
  - `scripts/scale-performance-check.mjs` [reference]
  - `src/lib/server/history.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### list_items

**Columns**
  - `id` TEXT (PK)
  - `section_id` TEXT (NOT NULL)
  - `content` TEXT (NOT NULL)
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `is_checked` INTEGER (NOT NULL, DEFAULT 0)
  - `amount` REAL (NOT NULL, DEFAULT 0)
  - `par_count` REAL (NOT NULL, DEFAULT 0)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `amount_text` TEXT (NOT NULL, DEFAULT '')
  - `details` TEXT (NOT NULL, DEFAULT '')
  - `business_id` TEXT

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select, update]
  - `src/lib/server/history.ts` [select]
  - `src/lib/server/itemAttachments.ts` [reference]
  - `src/lib/server/preplist.ts` [insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### list_sections

**Columns**
  - `id` TEXT (PK)
  - `domain` TEXT (NOT NULL)
  - `slug` TEXT (NOT NULL)
  - `title` TEXT (NOT NULL)
  - `description` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/lists/inventory` `src/routes/lists/inventory/+page.server.ts` [select]
  - `/lists/orders` `src/routes/lists/orders/+page.server.ts` [select]
  - `/lists/preplists` `src/routes/lists/preplists/+page.server.ts` [select]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select, update]
  - `src/lib/server/history.ts` [select]
  - `src/lib/server/preplist.ts` [select]
  - `src/lib/server/tenant.ts` [reference]

### list_submission_batches

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `domain` TEXT (NOT NULL)
  - `section_id` TEXT (NOT NULL)
  - `section_title_snapshot` TEXT (NOT NULL)
  - `submitted_by` TEXT
  - `submitted_at` INTEGER (NOT NULL)
  - `business_day` TEXT (NOT NULL)
  - `notes` TEXT

**Code Usage**
  - `src/lib/server/history.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### list_submission_items

**Columns**
  - `id` TEXT (PK)
  - `batch_id` TEXT (NOT NULL)
  - `business_id` TEXT (NOT NULL)
  - `item_id` TEXT (NOT NULL)
  - `item_name_snapshot` TEXT (NOT NULL)
  - `details_snapshot` TEXT
  - `submitted_value` TEXT (NOT NULL, DEFAULT '')
  - `par_count_snapshot` REAL (NOT NULL, DEFAULT 0)
  - `is_checked_snapshot` INTEGER (NOT NULL, DEFAULT 0)

**Code Usage**
  - `src/lib/server/history.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### operational_event_delivery_attempts

**Columns**
  - `id` TEXT (PK)
  - `event_id` TEXT (NOT NULL)
  - `business_id` TEXT (NOT NULL)
  - `channel` TEXT (NOT NULL)
  - `status` TEXT (NOT NULL)
  - `provider_message_id` TEXT
  - `error_message` TEXT
  - `attempted_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/operational-events-check.mjs` [ddl]
  - `src/lib/server/operationalEvents.ts` [ddl, insert]
  - `src/lib/server/tenant.ts` [reference]

### operational_events

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `event_type` TEXT (NOT NULL)
  - `category` TEXT (NOT NULL)
  - `severity` TEXT (NOT NULL, DEFAULT 'info')
  - `actor_user_id` TEXT
  - `target_user_id` TEXT
  - `subject_type` TEXT (NOT NULL, DEFAULT '')
  - `subject_id` TEXT (NOT NULL, DEFAULT '')
  - `title` TEXT (NOT NULL, DEFAULT '')
  - `body` TEXT (NOT NULL, DEFAULT '')
  - `payload_json` TEXT (NOT NULL, DEFAULT '{}')
  - `metadata_json` TEXT (NOT NULL, DEFAULT '{}')
  - `dedupe_key` TEXT
  - `delivery_status` TEXT (NOT NULL, DEFAULT 'pending')
  - `delivery_attempts` INTEGER (NOT NULL, DEFAULT 0)
  - `next_attempt_at` INTEGER
  - `last_attempt_at` INTEGER
  - `delivered_at` INTEGER
  - `failed_at` INTEGER
  - `expires_at` INTEGER
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/operational-events-check.mjs` [ddl]
  - `src/lib/server/operationalEvents.ts` [ddl, delete, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### password_resets

**Columns**
  - `id` TEXT (PK)
  - `user_id` TEXT (NOT NULL)
  - `email` TEXT (NOT NULL)
  - `token_hash` TEXT (NOT NULL)
  - `created_at` INTEGER (NOT NULL)
  - `expires_at` INTEGER (NOT NULL)
  - `used_at` INTEGER
  - `requested_ip` TEXT

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/reset-password/:token` `src/routes/reset-password/[token]/+page.server.ts` [update]
  - `src/lib/server/passwordReset.ts` [ddl, delete, insert, select, update]

### push_notification_devices

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `platform` TEXT (NOT NULL, DEFAULT 'unknown')
  - `device_token` TEXT (NOT NULL)
  - `token_hash` TEXT (NOT NULL)
  - `device_id` TEXT
  - `user_agent` TEXT (NOT NULL, DEFAULT '')
  - `app_version` TEXT (NOT NULL, DEFAULT '')
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `last_seen_at` INTEGER
  - `revoked_at` INTEGER

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/native-push-check.mjs` [ddl]
  - `src/lib/server/pushNotifications.ts` [ddl, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### recipes

**Columns**
  - `id` INTEGER (PK)
  - `title` TEXT (NOT NULL)
  - `category` TEXT (NOT NULL)
  - `ingredients` TEXT (NOT NULL)
  - `instructions` TEXT (NOT NULL)
  - `created_at` TEXT (NOT NULL, DEFAULT (datetime('now')))
  - `business_id` TEXT

**Code Usage**
  - `/+layout.svelte` `src/routes/+layout.svelte` [reference]
  - `/+page.svelte` `src/routes/+page.svelte` [reference]
  - `/admin/+page.svelte` `src/routes/admin/+page.svelte` [reference]
  - `/admin/creator/+page.svelte` `src/routes/admin/creator/+page.svelte` [reference]
  - `/admin/creator` `src/routes/admin/creator/+page.server.ts` [reference]
  - `/features/+page.svelte` `src/routes/features/+page.svelte` [reference]
  - `/how-it-works/+page.svelte` `src/routes/how-it-works/+page.svelte` [reference]
  - `/pricing/+page.svelte` `src/routes/pricing/+page.svelte` [reference]
  - `/recipes/+page.svelte` `src/routes/recipes/+page.svelte` [reference]
  - `/recipes/:category/+page.svelte` `src/routes/recipes/[category]/+page.svelte` [reference]
  - `/recipes/:category` `src/routes/recipes/[category]/+page.server.ts` [select]
  - `/recipes` `src/routes/recipes/+page.server.ts` [select]
  - `/register/+page.svelte` `src/routes/register/+page.svelte` [reference]
  - `scripts/admin-consolidation-check.mjs` [reference]
  - `scripts/core-feature-actions-check.mjs` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/local-smoke-check.mjs` [reference]
  - `scripts/prod-smoke-check.mjs` [reference]
  - `src/lib/assets/navigation.ts` [reference]
  - `src/lib/auth/roles.ts` [reference]
  - `src/lib/auth/routeCapabilities.ts` [reference]
  - `src/lib/components/ui/Layout.svelte` [reference]
  - `src/lib/features/appFeatures.ts` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select, update]
  - `src/lib/server/email.ts` [reference]
  - `src/lib/server/itemAttachments.ts` [select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_departments

**Columns**
  - `id` TEXT (PK)
  - `name` TEXT (NOT NULL)
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `/admin/onboarding/+page.svelte` `src/routes/admin/onboarding/+page.svelte` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [reference]
  - `src/lib/server/schedules.ts` [ddl, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### schedule_labor_targets

**Columns**
  - `business_id` TEXT (NOT NULL)
  - `day_date` TEXT (NOT NULL)
  - `week_start` TEXT (NOT NULL)
  - `projected_sales` REAL (NOT NULL, DEFAULT 0)
  - `target_labor_percent` REAL (NOT NULL, DEFAULT 0)
  - `average_hourly_rate` REAL (NOT NULL, DEFAULT 0)
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/schedules.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_open_shift_requests

**Columns**
  - `id` TEXT (PK)
  - `open_shift_id` TEXT (NOT NULL)
  - `requested_by_user_id` TEXT (NOT NULL)
  - `status` TEXT (NOT NULL, DEFAULT 'pending')
  - `manager_note` TEXT (NOT NULL, DEFAULT '')
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `resolved_at` INTEGER
  - `resolved_by_user_id` TEXT
  - `business_id` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### schedule_open_shifts

**Columns**
  - `id` TEXT (PK)
  - `week_id` TEXT (NOT NULL)
  - `shift_date` TEXT (NOT NULL)
  - `department` TEXT (NOT NULL)
  - `role` TEXT (NOT NULL)
  - `detail` TEXT (NOT NULL, DEFAULT '')
  - `start_time` TEXT (NOT NULL)
  - `end_label` TEXT (NOT NULL, DEFAULT '')
  - `break_minutes` INTEGER (NOT NULL, DEFAULT 0)
  - `notes` TEXT (NOT NULL, DEFAULT '')
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_preferences

**Columns**
  - `id` TEXT (PK)
  - `autofill_new_weeks` INTEGER (NOT NULL, DEFAULT 0)
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT
  - `business_id` TEXT

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/schedules.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_publish_history

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `schedule_week_id` TEXT (NOT NULL)
  - `week_start` TEXT (NOT NULL)
  - `published_by` TEXT
  - `published_at` INTEGER (NOT NULL)
  - `version_number` INTEGER (NOT NULL)
  - `notes` TEXT

**Code Usage**
  - `src/lib/server/history.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_role_definitions

**Columns**
  - `id` TEXT (PK)
  - `department` TEXT (NOT NULL)
  - `role_name` TEXT (NOT NULL)
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_shift_history

**Columns**
  - `id` TEXT (PK)
  - `publish_history_id` TEXT (NOT NULL)
  - `business_id` TEXT (NOT NULL)
  - `shift_id_snapshot` TEXT (NOT NULL)
  - `shift_date` TEXT (NOT NULL)
  - `user_id` TEXT
  - `employee_name_snapshot` TEXT (NOT NULL)
  - `department` TEXT (NOT NULL)
  - `role_name` TEXT (NOT NULL)
  - `detail` TEXT
  - `start_time` TEXT (NOT NULL)
  - `end_label` TEXT
  - `break_minutes` INTEGER (NOT NULL, DEFAULT 0)
  - `notes` TEXT
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)

**Code Usage**
  - `src/lib/server/history.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_shift_offers

**Columns**
  - `id` TEXT (PK)
  - `shift_id` TEXT (NOT NULL)
  - `offered_by_user_id` TEXT (NOT NULL)
  - `target_user_id` TEXT
  - `requested_by_user_id` TEXT
  - `manager_note` TEXT (NOT NULL, DEFAULT '')
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### schedule_shifts

**Columns**
  - `id` TEXT (PK)
  - `week_id` TEXT (NOT NULL)
  - `shift_date` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `department` TEXT (NOT NULL)
  - `role` TEXT (NOT NULL)
  - `detail` TEXT (NOT NULL, DEFAULT '')
  - `start_time` TEXT (NOT NULL)
  - `end_label` TEXT (NOT NULL, DEFAULT '')
  - `notes` TEXT (NOT NULL, DEFAULT '')
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `break_minutes` INTEGER (NOT NULL, DEFAULT 0)
  - `business_id` TEXT

**Code Usage**
  - `/admin` `src/routes/admin/+page.server.ts` [select]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/history.ts` [select]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### schedule_template_shifts

**Columns**
  - `id` TEXT (PK)
  - `template_id` TEXT (NOT NULL)
  - `weekday` INTEGER (NOT NULL)
  - `user_id` TEXT
  - `is_open` INTEGER (NOT NULL, DEFAULT 0)
  - `department` TEXT (NOT NULL)
  - `role` TEXT (NOT NULL)
  - `detail` TEXT (NOT NULL, DEFAULT '')
  - `start_time` TEXT (NOT NULL)
  - `end_label` TEXT (NOT NULL, DEFAULT '')
  - `break_minutes` INTEGER (NOT NULL, DEFAULT 0)
  - `notes` TEXT (NOT NULL, DEFAULT '')
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `business_id` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_templates

**Columns**
  - `id` TEXT (PK)
  - `name` TEXT (NOT NULL)
  - `department` TEXT (NOT NULL, DEFAULT '')
  - `labor_target_percent` REAL (NOT NULL, DEFAULT 0)
  - `projected_sales` REAL (NOT NULL, DEFAULT 0)
  - `average_hourly_rate` REAL (NOT NULL, DEFAULT 0)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `created_by` TEXT
  - `business_id` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/schedules.ts` [ddl, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### schedule_week_team

**Columns**
  - `week_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `sort_order` INTEGER (NOT NULL, DEFAULT 0)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### schedule_weeks

**Columns**
  - `id` TEXT (PK)
  - `week_start` TEXT (NOT NULL)
  - `status` TEXT (NOT NULL, DEFAULT 'draft')
  - `published_at` INTEGER
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT
  - `business_id` TEXT (NOT NULL, DEFAULT '')

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/schedules.ts` [ddl, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### security_rate_limits

**Columns**
  - `key_hash` TEXT (PK)
  - `action` TEXT (NOT NULL)
  - `window_start` INTEGER (NOT NULL)
  - `count` INTEGER (NOT NULL)
  - `blocked_until` INTEGER
  - `last_seen_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/auth-abuse-check.mjs` [reference]
  - `src/lib/server/security.ts` [ddl, delete, insert, select, update]

### sensor_nodes

**Columns**
  - `sensor_id` INTEGER (PK)
  - `name` TEXT (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/app` `src/routes/app/+page.server.ts` [select]
  - `/temper` `src/routes/temper/+page.server.ts` [select]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/temperatureDeviceProvisioning.ts` [insert, update]
  - `src/lib/server/temperatureMonitoring.ts` [select]
  - `src/lib/server/tenant.ts` [reference]

### sessions

**Columns**
  - `id` TEXT (PK)
  - `user_id` TEXT (NOT NULL)
  - `device_id` TEXT
  - `session_token_hash` TEXT (NOT NULL)
  - `created_at` INTEGER (NOT NULL)
  - `last_seen_at` INTEGER (NOT NULL)
  - `expires_at` INTEGER (NOT NULL)
  - `revoked_at` INTEGER
  - `ip_address` TEXT
  - `user_agent` TEXT

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/api/internal/smoke/session` `src/routes/api/internal/smoke/session/+server.ts` [insert, update]
  - `/login` `src/routes/login/+page.server.ts` [insert, update]
  - `/logout` `src/routes/logout/+page.server.ts` [update]
  - `/privacy/+page.svelte` `src/routes/privacy/+page.svelte` [reference]
  - `/register` `src/routes/register/+page.server.ts` [insert]
  - `/settings/+page.svelte` `src/routes/settings/+page.svelte` [reference]
  - `/settings` `src/routes/settings/+page.server.ts` [reference]
  - `scripts/auth-abuse-check.mjs` [update]
  - `scripts/malicious-user-hardening-check.mjs` [insert]
  - `src/hooks.server.ts` [select, update]
  - `src/lib/server/admin.ts` [reference]
  - `src/lib/server/security.ts` [select, update]

### store_billing_placeholders

**Columns**
  - `business_id` TEXT (PK)
  - `owner_user_id` TEXT (NOT NULL)
  - `preferred_store` TEXT (NOT NULL, DEFAULT 'both')
  - `plan_tier` TEXT (NOT NULL)
  - `addon_temp_monitoring` INTEGER (NOT NULL, DEFAULT 0)
  - `addon_camera_monitoring` INTEGER (NOT NULL, DEFAULT 0)
  - `status` TEXT (NOT NULL, DEFAULT 'pending_setup')
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/storeBilling.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]
  - `src/lib/server/trial.ts` [select]

### store_products

**Columns**
  - `id` TEXT (PK)
  - `store` TEXT (NOT NULL)
  - `product_id` TEXT (NOT NULL)
  - `display_name` TEXT (NOT NULL)
  - `entitlement_key` TEXT (NOT NULL)
  - `plan_tier` TEXT
  - `billing_period` TEXT (NOT NULL, DEFAULT 'monthly')
  - `price_cents` INTEGER (NOT NULL)
  - `currency` TEXT (NOT NULL, DEFAULT 'USD')
  - `addon_temp_monitoring` INTEGER (NOT NULL, DEFAULT 0)
  - `addon_camera_monitoring` INTEGER (NOT NULL, DEFAULT 0)
  - `active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/billing-lifecycle-check.mjs` [reference]
  - `scripts/cloudflare-readiness-check.mjs` [reference]
  - `src/lib/server/storeBilling.ts` [select]

### store_purchase_events

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `store` TEXT (NOT NULL)
  - `product_id` TEXT (NOT NULL)
  - `purchase_token_hash` TEXT
  - `original_transaction_id` TEXT
  - `transaction_id` TEXT
  - `event_type` TEXT (NOT NULL)
  - `verification_status` TEXT (NOT NULL)
  - `raw_payload_json` TEXT
  - `created_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/billing-lifecycle-check.mjs` [reference]
  - `src/lib/server/storeBilling.ts` [insert]
  - `src/lib/server/tenant.ts` [reference]

### store_webhook_events

**Columns**
  - `id` TEXT (PK)
  - `store` TEXT (NOT NULL)
  - `event_id` TEXT (NOT NULL)
  - `event_type` TEXT (NOT NULL)
  - `processed_status` TEXT (NOT NULL, DEFAULT 'pending')
  - `raw_payload_json` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `processed_at` INTEGER

**Code Usage**
  - `/api/billing/app-store-notifications` `src/routes/api/billing/app-store-notifications/+server.ts` [insert, update]
  - `/api/billing/google-play-notifications` `src/routes/api/billing/google-play-notifications/+server.ts` [insert, update]
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/billing-lifecycle-check.mjs` [reference]

### temperature_alert_events

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `sensor_id` INTEGER (NOT NULL)
  - `event_type` TEXT (NOT NULL)
  - `status` TEXT (NOT NULL, DEFAULT 'active')
  - `temperature` REAL
  - `threshold` REAL
  - `reading_ts` INTEGER
  - `first_seen_at` INTEGER (NOT NULL)
  - `last_seen_at` INTEGER (NOT NULL)
  - `acknowledged_at` INTEGER
  - `acknowledged_by` TEXT
  - `recovered_at` INTEGER
  - `dedupe_key` TEXT (NOT NULL)
  - `metadata_json` TEXT (NOT NULL, DEFAULT '{}')

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/temperature-monitoring-check.mjs` [ddl]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/temperatureMonitoring.ts` [ddl, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### temperature_sensor_nodes

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `gateway_device_id` TEXT (NOT NULL)
  - `node_serial` TEXT (NOT NULL)
  - `sensor_id` INTEGER (NOT NULL)
  - `display_name` TEXT (NOT NULL)
  - `hardware_model` TEXT
  - `firmware_version` TEXT
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `last_seen_at` INTEGER
  - `battery_mv` INTEGER
  - `rssi` INTEGER
  - `revoked_at` INTEGER
  - `created_by` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/iot-device-auth-check.mjs` [ddl]
  - `scripts/temperature-monitoring-check.mjs` [ddl]
  - `src/lib/server/temperatureDeviceProvisioning.ts` [ddl, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### temperature_sensor_settings

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `sensor_id` INTEGER (NOT NULL)
  - `high_threshold` REAL (NOT NULL, DEFAULT 42)
  - `low_threshold` REAL (NOT NULL, DEFAULT 32)
  - `stale_after_minutes` INTEGER (NOT NULL, DEFAULT 15)
  - `offline_after_minutes` INTEGER (NOT NULL, DEFAULT 45)
  - `alert_cooldown_minutes` INTEGER (NOT NULL, DEFAULT 60)
  - `is_alerting_enabled` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `updated_by` TEXT

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/temperature-monitoring-check.mjs` [ddl]
  - `src/lib/server/temperatureMonitoring.ts` [ddl, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### temps

**Columns**
  - `id` INTEGER (PK)
  - `sensor_id` INTEGER (NOT NULL)
  - `temperature` REAL (NOT NULL)
  - `ts` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/admin/+page.svelte` `src/routes/admin/+page.svelte` [reference]
  - `/admin` `src/routes/admin/+page.server.ts` [select]
  - `/api/temps` `src/routes/api/temps/+server.ts` [insert, select]
  - `/app/+page.svelte` `src/routes/app/+page.svelte` [reference]
  - `/app` `src/routes/app/+page.server.ts` [select]
  - `/temper/+page.svelte` `src/routes/temper/+page.svelte` [reference]
  - `scripts/auth-abuse-check.mjs` [reference]
  - `scripts/billing-lifecycle-check.mjs` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/iot-device-auth-check.mjs` [reference]
  - `scripts/malicious-user-hardening-check.mjs` [reference]
  - `scripts/operational-events-check.mjs` [reference]
  - `scripts/scale-performance-check.mjs` [delete, select]
  - `scripts/temperature-monitoring-check.mjs` [reference]
  - `scripts/tenant-isolation-check.mjs` [reference]
  - `src/hooks.server.ts` [reference]
  - `src/lib/assets/navigation.ts` [reference]
  - `src/lib/features/appFeatures.ts` [reference]
  - `src/lib/server/privateTestGate.ts` [reference]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/retention.ts` [delete, select]
  - `src/lib/server/temperatureMonitoring.ts` [select]
  - `src/lib/server/tenant.ts` [reference]

### todo_assignments

**Columns**
  - `todo_id` TEXT (PK)
  - `user_id` TEXT (NOT NULL)
  - `assigned_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/app` `src/routes/app/+page.server.ts` [select]
  - `/todo` `src/routes/todo/+page.server.ts` [select]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### todo_completion_log

**Columns**
  - `id` TEXT (PK)
  - `todo_id` TEXT (NOT NULL)
  - `title` TEXT (NOT NULL)
  - `completed_by` TEXT
  - `completed_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/todo/log` `src/routes/todo/log/+page.server.ts` [delete, select]
  - `/todo` `src/routes/todo/+page.server.ts` [insert]
  - `scripts/core-feature-actions-check.mjs` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, select]
  - `src/lib/server/tenant.ts` [reference]

### todos

**Columns**
  - `id` TEXT (PK)
  - `title` TEXT (NOT NULL)
  - `description` TEXT
  - `created_by` TEXT
  - `completed_by` TEXT
  - `completed_at` INTEGER
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/admin/+page.svelte` `src/routes/admin/+page.svelte` [reference]
  - `/admin` `src/routes/admin/+page.server.ts` [select]
  - `/app/+page.svelte` `src/routes/app/+page.svelte` [reference]
  - `/app` `src/routes/app/+page.server.ts` [select]
  - `/todo` `src/routes/todo/+page.server.ts` [delete, select, update]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### trial_denials

**Columns**
  - `id` TEXT (PK)
  - `email_normalized` TEXT
  - `business_name_normalized` TEXT
  - `client_fingerprint_hash` TEXT
  - `ip_hash` TEXT
  - `user_agent_hash` TEXT
  - `source` TEXT (NOT NULL)
  - `created_at` INTEGER (NOT NULL)
  - `last_seen_at` INTEGER (NOT NULL)
  - `notes` TEXT

**Code Usage**
  - `src/lib/server/trial.ts` [ddl, insert, select]

### trial_identity_claims

**Columns**
  - `identity_key` TEXT (PK)
  - `identity_type` TEXT (NOT NULL)
  - `identity_hash` TEXT (NOT NULL)
  - `business_id` TEXT
  - `user_id` TEXT
  - `source` TEXT (NOT NULL, DEFAULT 'trial_granted')
  - `status` TEXT (NOT NULL, DEFAULT 'active')
  - `first_seen_at` INTEGER (NOT NULL)
  - `last_seen_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `scripts/billing-lifecycle-check.mjs` [select]
  - `scripts/malicious-user-hardening-check.mjs` [reference]
  - `src/lib/server/trial.ts` [ddl, insert, select]

### user_invites

**Columns**
  - `id` TEXT (PK)
  - `email` TEXT (NOT NULL)
  - `email_normalized` TEXT (NOT NULL)
  - `invite_code` TEXT (NOT NULL)
  - `invited_by` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `expires_at` INTEGER
  - `used_at` INTEGER
  - `used_by_user_id` TEXT
  - `revoked_at` INTEGER

**Code Usage**
  - `/register` `src/routes/register/+page.server.ts` [select, update]
  - `src/lib/server/admin.ts` [ddl]

### user_preferences

**Columns**
  - `user_id` TEXT (PK)
  - `email_updates` INTEGER (NOT NULL, DEFAULT 1)
  - `sms_updates` INTEGER (NOT NULL, DEFAULT 0)
  - `dark_mode` INTEGER (NOT NULL, DEFAULT 0)
  - `language` TEXT (NOT NULL, DEFAULT 'en')
  - `welcome_tour_completed_at` INTEGER
  - `welcome_tour_variant` TEXT
  - `user_home_tour_completed_at` INTEGER
  - `admin_tour_completed_at` INTEGER
  - `updated_at` INTEGER (NOT NULL)
  - `push_updates` INTEGER (NOT NULL, DEFAULT 0)

**Code Usage**
  - `/` `src/routes/+layout.server.ts` [select]
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/register` `src/routes/register/+page.server.ts` [insert]
  - `/settings` `src/routes/settings/+page.server.ts` [insert, select]
  - `scripts/native-push-check.mjs` [ddl]
  - `src/lib/server/dbSchema.ts` [reference]
  - `src/lib/server/operationalEvents.ts` [select]
  - `src/lib/server/pushNotifications.ts` [insert]
  - `src/lib/server/userPreferences.ts` [ddl, insert, select]

### user_schedule_availability

**Columns**
  - `business_id` TEXT (NOT NULL, DEFAULT '')
  - `user_id` TEXT (NOT NULL)
  - `weekday` INTEGER (NOT NULL)
  - `is_available` INTEGER (NOT NULL, DEFAULT 0)
  - `start_time` TEXT (NOT NULL, DEFAULT '')
  - `end_time` TEXT (NOT NULL, DEFAULT '')
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### user_schedule_departments

**Columns**
  - `business_id` TEXT (NOT NULL, DEFAULT '')
  - `user_id` TEXT (NOT NULL)
  - `department` TEXT (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)

**Code Usage**
  - `/register` `src/routes/register/+page.server.ts` [insert]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `scripts/operational-events-check.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select]
  - `src/lib/server/operationalEvents.ts` [select]
  - `src/lib/server/schedules.ts` [ddl, delete, select]
  - `src/lib/server/tenant.ts` [reference]

### user_schedule_time_off_requests

**Columns**
  - `id` TEXT (PK)
  - `user_id` TEXT (NOT NULL)
  - `start_date` TEXT (NOT NULL)
  - `end_date` TEXT (NOT NULL)
  - `note` TEXT (NOT NULL, DEFAULT '')
  - `status` TEXT (NOT NULL, DEFAULT 'pending')
  - `manager_note` TEXT (NOT NULL, DEFAULT '')
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `resolved_at` INTEGER
  - `resolved_by_user_id` TEXT
  - `business_id` TEXT

**Code Usage**
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/schedules.ts` [ddl, delete, insert, select, update]
  - `src/lib/server/tenant.ts` [reference]

### users

**Columns**
  - `id` TEXT (PK)
  - `email` TEXT (NOT NULL)
  - `email_normalized` TEXT (NOT NULL)
  - `password_hash` TEXT
  - `display_name` TEXT
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `email_verified_at` INTEGER
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `role` TEXT (DEFAULT 'user')

**Code Usage**
  - `/+layout.svelte` `src/routes/+layout.svelte` [reference]
  - `/account-deletion/+page.svelte` `src/routes/account-deletion/+page.svelte` [reference]
  - `/admin/+page.svelte` `src/routes/admin/+page.svelte` [reference]
  - `/admin/onboarding/+page.svelte` `src/routes/admin/onboarding/+page.svelte` [reference]
  - `/admin/onboarding` `src/routes/admin/onboarding/+page.server.ts` [reference]
  - `/admin/schedule/+page.svelte` `src/routes/admin/schedule/+page.svelte` [reference]
  - `/admin/schedule` `src/routes/admin/schedule/+page.server.ts` [reference]
  - `/admin/users/+page.svelte` `src/routes/admin/users/+page.svelte` [reference]
  - `/admin/users/:id` `src/routes/admin/users/[id]/+page.server.ts` [reference]
  - `/admin/users` `src/routes/admin/users/+page.server.ts` [reference]
  - `/admin` `src/routes/admin/+page.server.ts` [select]
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/api/internal/smoke/session` `src/routes/api/internal/smoke/session/+server.ts` [select]
  - `/api/whiteboard` `src/routes/api/whiteboard/+server.ts` [reference]
  - `/app` `src/routes/app/+page.server.ts` [select]
  - `/billing` `src/routes/billing/+page.server.ts` [select]
  - `/features/+page.svelte` `src/routes/features/+page.svelte` [reference]
  - `/how-it-works/+page.svelte` `src/routes/how-it-works/+page.svelte` [reference]
  - `/login` `src/routes/login/+page.server.ts` [select, update]
  - `/pricing/+page.svelte` `src/routes/pricing/+page.svelte` [reference]
  - `/privacy/+page.svelte` `src/routes/privacy/+page.svelte` [reference]
  - `/register/+page.svelte` `src/routes/register/+page.svelte` [reference]
  - `/register` `src/routes/register/+page.server.ts` [insert, select]
  - `/reset-password/:token` `src/routes/reset-password/[token]/+page.server.ts` [update]
  - `/settings` `src/routes/settings/+page.server.ts` [select, update]
  - `/terms/+page.svelte` `src/routes/terms/+page.svelte` [reference]
  - `/todo/log` `src/routes/todo/log/+page.server.ts` [select]
  - `/todo` `src/routes/todo/+page.server.ts` [select]
  - `/tools/waste` `src/routes/tools/waste/+page.server.ts` [select]
  - `scripts/auth-abuse-check.mjs` [reference]
  - `scripts/authorization-capability-check.mjs` [reference]
  - `scripts/hr-onboarding-check.mjs` [reference]
  - `scripts/local-smoke-check.mjs` [reference]
  - `scripts/malicious-user-hardening-check.mjs` [update]
  - `scripts/prod-smoke-check.mjs` [reference]
  - `scripts/tenant-authority-check.mjs` [reference]
  - `src/hooks.server.ts` [select]
  - `src/lib/auth/routeCapabilities.ts` [reference]
  - `src/lib/components/ui/AdminEditorMenu.svelte` [reference]
  - `src/lib/server/admin.ts` [delete, select, update]
  - `src/lib/server/announcements.ts` [reference]
  - `src/lib/server/appFeatures.ts` [reference]
  - `src/lib/server/business.ts` [reference]
  - `src/lib/server/dailySpecials.ts` [reference]
  - `src/lib/server/dbSchema.ts` [reference]
  - `src/lib/server/employeeSpotlight.ts` [reference]
  - `src/lib/server/history.ts` [select]
  - `src/lib/server/iotIngest.ts` [reference]
  - `src/lib/server/itemAttachments.ts` [reference]
  - `src/lib/server/operationalEvents.ts` [select]
  - `src/lib/server/passwordReset.ts` [select]
  - `src/lib/server/reports.ts` [select]
  - `src/lib/server/schedules.ts` [select]
  - `src/lib/server/temperatureDeviceProvisioning.ts` [reference]
  - `src/lib/server/trial.ts` [delete, select]
  - `src/lib/server/userPreferences.ts` [reference]
  - `src/lib/server/vendors.ts` [reference]

### vendor_resources

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `name` TEXT (NOT NULL)
  - `website_url` TEXT
  - `phone` TEXT
  - `contact_name` TEXT
  - `notes` TEXT
  - `is_active` INTEGER (NOT NULL, DEFAULT 1)
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `created_by` TEXT
  - `updated_by` TEXT

**Code Usage**
  - `src/lib/server/tenant.ts` [reference]
  - `src/lib/server/vendors.ts` [ddl, delete, insert, select, update]

### waste_logs

**Columns**
  - `id` TEXT (PK)
  - `business_id` TEXT (NOT NULL)
  - `submitted_by_user_id` TEXT (NOT NULL)
  - `product` TEXT (NOT NULL)
  - `amount` REAL
  - `unit` TEXT (NOT NULL, DEFAULT '')
  - `reason` TEXT (NOT NULL)
  - `notes` TEXT (NOT NULL, DEFAULT '')
  - `created_at` INTEGER (NOT NULL)

**Code Usage**
  - `/api/internal/schema-readiness` `src/routes/api/internal/schema-readiness/+server.ts` [reference]
  - `/tools/waste` `src/routes/tools/waste/+page.server.ts` [insert, select]
  - `scripts/core-feature-actions-check.mjs` [insert]
  - `src/lib/server/reports.ts` [select]

### whiteboard_posts

**Columns**
  - `id` TEXT (PK)
  - `content` TEXT (NOT NULL)
  - `votes` INTEGER (NOT NULL, DEFAULT 0)
  - `created_by` TEXT
  - `created_at` INTEGER (NOT NULL)
  - `updated_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/api/whiteboard` `src/routes/api/whiteboard/+server.ts` [insert, select, update]
  - `/app` `src/routes/app/+page.server.ts` [select]
  - `scripts/core-feature-actions-check.mjs` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, select]
  - `src/lib/server/tenant.ts` [reference]

### whiteboard_review

**Columns**
  - `post_id` TEXT (PK)
  - `status` TEXT (NOT NULL, DEFAULT 'approved')
  - `reviewed_by` TEXT
  - `reviewed_at` INTEGER
  - `business_id` TEXT

**Code Usage**
  - `/api/whiteboard` `src/routes/api/whiteboard/+server.ts` [insert, select]
  - `/app` `src/routes/app/+page.server.ts` [select]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/admin.ts` [delete, insert, select]
  - `src/lib/server/tenant.ts` [reference]

### whiteboard_votes

**Columns**
  - `post_id` TEXT (NOT NULL)
  - `user_id` TEXT (NOT NULL)
  - `created_at` INTEGER (NOT NULL)
  - `business_id` TEXT

**Code Usage**
  - `/api/whiteboard` `src/routes/api/whiteboard/+server.ts` [insert, select]
  - `scripts/core-feature-actions-check.mjs` [reference]
  - `scripts/ensure-tenant-columns.mjs` [reference]
  - `src/lib/server/tenant.ts` [reference]
