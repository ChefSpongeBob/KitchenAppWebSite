-- Final tenant-scope indexes for Cloudflare D1 production readiness.
-- These mirror the runtime guards in src/lib/server/tenant.ts so a fresh deploy
-- starts with business-owned data indexed by business_id.

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_profiles_business_user
ON employee_profiles(business_id, user_id);

CREATE INDEX IF NOT EXISTS idx_employee_profile_edit_requests_business
ON employee_profile_edit_requests(business_id, status, requested_at);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_packages_business_user
ON employee_onboarding_packages(business_id, user_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_items_business_package
ON employee_onboarding_items(business_id, package_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_template_business_active
ON employee_onboarding_template_items(business_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_schedule_open_shifts_business_week
ON schedule_open_shifts(business_id, week_id, shift_date, start_time, sort_order);

CREATE INDEX IF NOT EXISTS idx_schedule_open_shift_requests_business_status
ON schedule_open_shift_requests(business_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_business_name
ON schedule_templates(business_id, name);

CREATE INDEX IF NOT EXISTS idx_schedule_template_shifts_business_template
ON schedule_template_shifts(business_id, template_id, weekday, sort_order);

CREATE INDEX IF NOT EXISTS idx_schedule_labor_targets_business_week
ON schedule_labor_targets(business_id, week_start, day_date);

CREATE INDEX IF NOT EXISTS idx_store_billing_placeholders_status
ON store_billing_placeholders(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_legal_agreements_business_user
ON legal_agreements(business_id, user_id, agreement_key, agreement_version);
