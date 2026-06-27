-- Schedule departments and roles now use code-level defaults plus tenant-scoped
-- customizations. Remove old shared DB default rows so no business reads or edits
-- schedule setup from another tenant/global pool.

DELETE FROM schedule_role_definitions
WHERE business_id IS NULL
   OR trim(business_id) = '';

DELETE FROM schedule_departments
WHERE business_id IS NULL
   OR trim(business_id) = '';
