-- Final tenant-scope indexes for Cloudflare D1 production readiness.
-- These mirror the runtime guards in src/lib/server/tenant.ts so a fresh deploy
-- starts with business-owned data indexed by business_id.

ALTER TABLE todos ADD COLUMN business_id TEXT;
ALTER TABLE todo_assignments ADD COLUMN business_id TEXT;
ALTER TABLE todo_completion_log ADD COLUMN business_id TEXT;
ALTER TABLE recipes ADD COLUMN business_id TEXT;
ALTER TABLE documents ADD COLUMN business_id TEXT;
ALTER TABLE whiteboard_posts ADD COLUMN business_id TEXT;
ALTER TABLE whiteboard_review ADD COLUMN business_id TEXT;
ALTER TABLE whiteboard_votes ADD COLUMN business_id TEXT;
ALTER TABLE list_sections ADD COLUMN business_id TEXT;
ALTER TABLE list_items ADD COLUMN business_id TEXT;
ALTER TABLE checklist_sections ADD COLUMN business_id TEXT;
ALTER TABLE checklist_items ADD COLUMN business_id TEXT;
ALTER TABLE announcements ADD COLUMN business_id TEXT;
ALTER TABLE employee_spotlight ADD COLUMN business_id TEXT;
ALTER TABLE daily_specials ADD COLUMN business_id TEXT;
ALTER TABLE daily_specials_editors ADD COLUMN business_id TEXT;
ALTER TABLE meeting_notes ADD COLUMN business_id TEXT;
ALTER TABLE sensor_nodes ADD COLUMN business_id TEXT;
ALTER TABLE temps ADD COLUMN business_id TEXT;
ALTER TABLE camera_events ADD COLUMN business_id TEXT;
ALTER TABLE camera_sources ADD COLUMN business_id TEXT;
ALTER TABLE schedule_shifts ADD COLUMN business_id TEXT;
ALTER TABLE schedule_week_team ADD COLUMN business_id TEXT;
ALTER TABLE schedule_shift_offers ADD COLUMN business_id TEXT;
ALTER TABLE schedule_preferences ADD COLUMN business_id TEXT;
ALTER TABLE schedule_role_definitions ADD COLUMN business_id TEXT;
ALTER TABLE schedule_departments ADD COLUMN business_id TEXT;
ALTER TABLE user_schedule_departments ADD COLUMN business_id TEXT;
ALTER TABLE user_schedule_availability ADD COLUMN business_id TEXT;
ALTER TABLE user_schedule_time_off_requests ADD COLUMN business_id TEXT;

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
