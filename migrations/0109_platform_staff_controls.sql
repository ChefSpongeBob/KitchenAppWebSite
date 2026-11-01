ALTER TABLE platform_staff_members ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE platform_staff_audit ADD COLUMN target_user_id TEXT;

CREATE TABLE platform_staff_step_up (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES platform_staff_members(user_id) ON DELETE CASCADE,
  membership_revision INTEGER NOT NULL,
  verified_at INTEGER NOT NULL,
  passkey_verified_at INTEGER
);
CREATE INDEX idx_platform_staff_step_up_user ON platform_staff_step_up(user_id);

CREATE TABLE platform_staff_passkeys (
  credential_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES platform_staff_members(user_id) ON DELETE CASCADE,
  rp_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX idx_platform_staff_passkeys_user ON platform_staff_passkeys(user_id, rp_id);

CREATE TABLE platform_staff_challenges (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES platform_staff_members(user_id) ON DELETE CASCADE,
  membership_revision INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  challenge TEXT NOT NULL,
  rp_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_platform_staff_challenges_user ON platform_staff_challenges(user_id);

DROP TRIGGER platform_staff_members_insert_audit;
CREATE TRIGGER platform_staff_members_insert_audit
AFTER INSERT ON platform_staff_members
WHEN NEW.granted_by IS NULL AND NEW.staff_role = 'owner'
BEGIN
  INSERT INTO platform_staff_audit (id, actor_user_id, target_user_id, action, reason, created_at)
  VALUES (lower(hex(randomblob(16))), NEW.user_id, NEW.user_id, 'platform_owner_bootstrapped',
    'Explicit operator-approved platform membership', NEW.created_at);
END;

CREATE TRIGGER platform_staff_last_owner_update
BEFORE UPDATE OF staff_role, is_active ON platform_staff_members
WHEN OLD.staff_role = 'owner' AND OLD.is_active = 1
  AND (NEW.staff_role <> 'owner' OR NEW.is_active <> 1)
  AND NOT EXISTS (
    SELECT 1 FROM platform_staff_members s JOIN users u ON u.id = s.user_id
    WHERE s.user_id <> OLD.user_id AND s.staff_role = 'owner' AND s.is_active = 1
      AND COALESCE(u.is_active, 1) = 1
  )
BEGIN SELECT RAISE(ABORT, 'At least one active platform owner must remain.'); END;

CREATE TRIGGER platform_staff_last_owner_delete
BEFORE DELETE ON platform_staff_members
WHEN OLD.staff_role = 'owner' AND OLD.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM platform_staff_members s JOIN users u ON u.id = s.user_id
    WHERE s.user_id <> OLD.user_id AND s.staff_role = 'owner' AND s.is_active = 1
      AND COALESCE(u.is_active, 1) = 1
  )
BEGIN SELECT RAISE(ABORT, 'At least one active platform owner must remain.'); END;

CREATE TRIGGER platform_staff_last_owner_account_inactive
BEFORE UPDATE OF is_active ON users
WHEN COALESCE(OLD.is_active, 1) = 1 AND NEW.is_active = 0
  AND EXISTS (SELECT 1 FROM platform_staff_members s WHERE s.user_id = OLD.id AND s.staff_role = 'owner' AND s.is_active = 1)
  AND NOT EXISTS (
    SELECT 1 FROM platform_staff_members s JOIN users u ON u.id = s.user_id
    WHERE s.user_id <> OLD.id AND s.staff_role = 'owner' AND s.is_active = 1 AND COALESCE(u.is_active, 1) = 1
  )
BEGIN SELECT RAISE(ABORT, 'At least one active platform owner must remain.'); END;

CREATE TRIGGER platform_staff_last_owner_account_delete
BEFORE DELETE ON users
WHEN EXISTS (SELECT 1 FROM platform_staff_members s WHERE s.user_id = OLD.id AND s.staff_role = 'owner' AND s.is_active = 1)
  AND NOT EXISTS (
    SELECT 1 FROM platform_staff_members s JOIN users u ON u.id = s.user_id
    WHERE s.user_id <> OLD.id AND s.staff_role = 'owner' AND s.is_active = 1 AND COALESCE(u.is_active, 1) = 1
  )
BEGIN SELECT RAISE(ABORT, 'At least one active platform owner must remain.'); END;

-- Preserve the assignment guard without blocking FK cleanup of a former staff identity.
DROP TRIGGER iot_reservation_no_reassignment;
CREATE TRIGGER iot_reservation_no_reassignment
BEFORE UPDATE OF serial, business_id ON iot_device_reservations
BEGIN SELECT RAISE(ABORT, 'Release the reservation before reassigning it.'); END;

CREATE TRIGGER platform_staff_access_changed
AFTER UPDATE OF staff_role, is_active, revision ON platform_staff_members
WHEN OLD.staff_role <> NEW.staff_role OR OLD.is_active <> NEW.is_active OR OLD.revision <> NEW.revision
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.user_id;
  DELETE FROM platform_staff_challenges WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER platform_staff_account_inactive
AFTER UPDATE OF is_active ON users
WHEN COALESCE(OLD.is_active, 1) <> COALESCE(NEW.is_active, 1)
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
  DELETE FROM platform_staff_challenges WHERE user_id = NEW.id;
END;

CREATE TRIGGER platform_staff_password_changed
AFTER UPDATE OF password_hash ON users
WHEN OLD.password_hash IS NOT NEW.password_hash
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
  DELETE FROM platform_staff_challenges WHERE user_id = NEW.id;
END;
