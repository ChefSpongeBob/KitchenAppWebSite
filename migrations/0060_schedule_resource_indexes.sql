-- Additional tenant-first indexes for schedule/admin scale.
-- These support hot schedule builder, employee setup, and native billing paths
-- without changing table data or behavior.

CREATE INDEX IF NOT EXISTS idx_schedule_departments_business_active_order
ON schedule_departments(business_id, is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_schedule_departments_business_name
ON schedule_departments(business_id, name);

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_business_active_department
ON schedule_role_definitions(business_id, is_active, department, sort_order, role_name);

CREATE INDEX IF NOT EXISTS idx_schedule_role_definitions_business_department_role
ON schedule_role_definitions(business_id, department, role_name);

CREATE INDEX IF NOT EXISTS idx_schedule_preferences_business
ON schedule_preferences(business_id, id);

CREATE INDEX IF NOT EXISTS idx_user_schedule_departments_business_user
ON user_schedule_departments(business_id, user_id, department);

CREATE INDEX IF NOT EXISTS idx_schedule_open_shift_requests_business_open_user
ON schedule_open_shift_requests(business_id, open_shift_id, requested_by_user_id, status);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_business_updated
ON schedule_templates(business_id, updated_at DESC, name);

CREATE INDEX IF NOT EXISTS idx_store_purchase_events_business_status_created
ON store_purchase_events(business_id, verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_webhook_events_status_created
ON store_webhook_events(processed_status, created_at);
