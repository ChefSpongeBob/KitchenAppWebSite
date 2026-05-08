ALTER TABLE employee_onboarding_items ADD COLUMN form_key TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_onboarding_items ADD COLUMN form_payload TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_onboarding_template_items ADD COLUMN form_key TEXT NOT NULL DEFAULT '';
