-- Remove the rejected staff passkey flow without changing restaurant accounts or audit history.
DROP TRIGGER platform_staff_access_changed;
DROP TRIGGER platform_staff_account_inactive;
DROP TRIGGER platform_staff_password_changed;

CREATE TRIGGER platform_staff_access_changed
AFTER UPDATE OF staff_role, is_active, revision ON platform_staff_members
WHEN OLD.staff_role <> NEW.staff_role OR OLD.is_active <> NEW.is_active OR OLD.revision <> NEW.revision
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER platform_staff_account_inactive
AFTER UPDATE OF is_active ON users
WHEN COALESCE(OLD.is_active, 1) <> COALESCE(NEW.is_active, 1)
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
END;

CREATE TRIGGER platform_staff_password_changed
AFTER UPDATE OF password_hash ON users
WHEN OLD.password_hash IS NOT NEW.password_hash
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
END;

DELETE FROM platform_staff_step_up;
DROP TABLE platform_staff_challenges;
DROP TABLE platform_staff_passkeys;
ALTER TABLE platform_staff_step_up DROP COLUMN passkey_verified_at;
