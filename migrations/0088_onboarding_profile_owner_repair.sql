-- Repairs onboarding/profile drift found during live tenant testing.
-- 1) Owners must not be downgraded into employee onboarding.
-- 2) Profile-backed onboarding items should reflect completed employee profile data.

UPDATE employee_employment_records
SET
  employment_status = CASE
    WHEN employment_status = 'terminated' THEN employment_status
    ELSE 'active'
  END,
  employment_type = 'owner',
  onboarding_package_id = NULL,
  updated_at = unixepoch()
WHERE EXISTS (
  SELECT 1
  FROM business_users bu
  WHERE bu.business_id = employee_employment_records.business_id
    AND bu.user_id = employee_employment_records.user_id
    AND bu.role = 'owner'
    AND COALESCE(bu.is_active, 1) = 1
);

UPDATE employee_onboarding_items
SET
  status = 'submitted',
  form_payload = CASE
    WHEN COALESCE(form_payload, '') = '' THEN '{"protected_record":"Profile record"}'
    ELSE form_payload
  END,
  signed_name = CASE
    WHEN COALESCE(signed_name, '') = '' THEN (
      SELECT ep.real_name
      FROM employee_profiles ep
      WHERE ep.business_id = employee_onboarding_items.business_id
        AND ep.user_id = employee_onboarding_items.user_id
      LIMIT 1
    )
    ELSE signed_name
  END,
  submitted_at = COALESCE(submitted_at, (
    SELECT p.sent_at
    FROM employee_onboarding_packages p
    WHERE p.id = employee_onboarding_items.package_id
      AND p.business_id = employee_onboarding_items.business_id
    LIMIT 1
  )),
  manager_note = '',
  reviewed_at = NULL,
  reviewed_by = NULL
WHERE status = 'pending'
  AND form_key = 'personal_information'
  AND EXISTS (
    SELECT 1
    FROM employee_profiles ep
    WHERE ep.business_id = employee_onboarding_items.business_id
      AND ep.user_id = employee_onboarding_items.user_id
      AND COALESCE(ep.real_name, '') <> ''
      AND COALESCE(ep.birthday, '') <> ''
      AND COALESCE(ep.phone, '') <> ''
      AND COALESCE(ep.address_line_1, '') <> ''
      AND COALESCE(ep.city, '') <> ''
      AND COALESCE(ep.state, '') <> ''
      AND COALESCE(ep.postal_code, '') <> ''
  );

UPDATE employee_onboarding_items
SET
  status = 'submitted',
  form_payload = CASE
    WHEN COALESCE(form_payload, '') = '' THEN '{"protected_record":"Profile record"}'
    ELSE form_payload
  END,
  signed_name = CASE
    WHEN COALESCE(signed_name, '') = '' THEN (
      SELECT ep.real_name
      FROM employee_profiles ep
      WHERE ep.business_id = employee_onboarding_items.business_id
        AND ep.user_id = employee_onboarding_items.user_id
      LIMIT 1
    )
    ELSE signed_name
  END,
  submitted_at = COALESCE(submitted_at, (
    SELECT p.sent_at
    FROM employee_onboarding_packages p
    WHERE p.id = employee_onboarding_items.package_id
      AND p.business_id = employee_onboarding_items.business_id
    LIMIT 1
  )),
  manager_note = '',
  reviewed_at = NULL,
  reviewed_by = NULL
WHERE status = 'pending'
  AND form_key = 'emergency_contact'
  AND EXISTS (
    SELECT 1
    FROM employee_profiles ep
    WHERE ep.business_id = employee_onboarding_items.business_id
      AND ep.user_id = employee_onboarding_items.user_id
      AND COALESCE(ep.emergency_contact_name, '') <> ''
      AND COALESCE(ep.emergency_contact_phone, '') <> ''
      AND COALESCE(ep.emergency_contact_relationship, '') <> ''
  );

UPDATE employee_compliance_documents
SET
  status = 'submitted',
  signed_name = CASE
    WHEN COALESCE(signed_name, '') = '' THEN (
      SELECT i.signed_name
      FROM employee_onboarding_items i
      WHERE i.id = employee_compliance_documents.onboarding_item_id
        AND i.business_id = employee_compliance_documents.business_id
      LIMIT 1
    )
    ELSE signed_name
  END,
  submitted_at = COALESCE(submitted_at, (
    SELECT i.submitted_at
    FROM employee_onboarding_items i
    WHERE i.id = employee_compliance_documents.onboarding_item_id
      AND i.business_id = employee_compliance_documents.business_id
    LIMIT 1
  )),
  updated_at = unixepoch()
WHERE EXISTS (
  SELECT 1
  FROM employee_onboarding_items i
  WHERE i.id = employee_compliance_documents.onboarding_item_id
    AND i.business_id = employee_compliance_documents.business_id
    AND i.status = 'submitted'
    AND i.form_key IN ('personal_information', 'emergency_contact')
);

UPDATE employee_onboarding_packages
SET
  status = CASE
    WHEN (
      SELECT COUNT(*)
      FROM employee_onboarding_items i
      WHERE i.package_id = employee_onboarding_packages.id
        AND i.business_id = employee_onboarding_packages.business_id
    ) > 0
    AND (
      SELECT COUNT(*)
      FROM employee_onboarding_items i
      WHERE i.package_id = employee_onboarding_packages.id
        AND i.business_id = employee_onboarding_packages.business_id
        AND i.status = 'approved'
    ) = (
      SELECT COUNT(*)
      FROM employee_onboarding_items i
      WHERE i.package_id = employee_onboarding_packages.id
        AND i.business_id = employee_onboarding_packages.business_id
    ) THEN 'approved'
    WHEN (
      SELECT COUNT(*)
      FROM employee_onboarding_items i
      WHERE i.package_id = employee_onboarding_packages.id
        AND i.business_id = employee_onboarding_packages.business_id
    ) > 0
    AND (
      SELECT COUNT(*)
      FROM employee_onboarding_items i
      WHERE i.package_id = employee_onboarding_packages.id
        AND i.business_id = employee_onboarding_packages.business_id
        AND i.status IN ('pending', 'needs_changes')
    ) = 0 THEN 'submitted'
    WHEN (
      SELECT COUNT(*)
      FROM employee_onboarding_items i
      WHERE i.package_id = employee_onboarding_packages.id
        AND i.business_id = employee_onboarding_packages.business_id
        AND i.status IN ('submitted', 'approved', 'needs_changes')
    ) > 0 THEN 'in_progress'
    ELSE status
  END,
  completed_at = CASE
    WHEN (
      SELECT COUNT(*)
      FROM employee_onboarding_items i
      WHERE i.package_id = employee_onboarding_packages.id
        AND i.business_id = employee_onboarding_packages.business_id
    ) > 0
    AND (
      SELECT COUNT(*)
      FROM employee_onboarding_items i
      WHERE i.package_id = employee_onboarding_packages.id
        AND i.business_id = employee_onboarding_packages.business_id
        AND i.status IN ('pending', 'needs_changes')
    ) = 0 THEN COALESCE(completed_at, unixepoch())
    ELSE completed_at
  END,
  updated_at = unixepoch();
