-- Each onboarding item should resolve to at most one compliance document row.

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_compliance_documents_onboarding_item
ON employee_compliance_documents(business_id, onboarding_item_id);
