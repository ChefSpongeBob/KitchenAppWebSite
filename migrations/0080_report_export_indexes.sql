CREATE INDEX IF NOT EXISTS idx_schedule_shift_offers_business_updated
ON schedule_shift_offers(business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_open_shift_requests_business_updated
ON schedule_open_shift_requests(business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_schedule_time_off_requests_business_updated
ON user_schedule_time_off_requests(business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_temperature_alert_events_business_seen
ON temperature_alert_events(business_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_onboarding_packages_business_updated
ON employee_onboarding_packages(business_id, updated_at DESC);
