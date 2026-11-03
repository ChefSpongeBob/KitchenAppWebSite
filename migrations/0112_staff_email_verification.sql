ALTER TABLE platform_staff_members ADD COLUMN otp_email TEXT;
ALTER TABLE platform_staff_step_up ADD COLUMN email_verified_at INTEGER;

CREATE TABLE platform_staff_email_challenges (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES platform_staff_members(user_id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL UNIQUE,
  membership_revision INTEGER NOT NULL,
  session_token_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('sign_in', 'change_email')),
  source_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  sent_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);
CREATE INDEX idx_staff_email_challenges_user_created ON platform_staff_email_challenges(user_id, created_at);
CREATE INDEX idx_staff_email_challenges_expiry ON platform_staff_email_challenges(expires_at);

-- Password-only confirmations must not unlock the email-protected console.
DELETE FROM platform_staff_step_up;

DROP TRIGGER platform_staff_access_changed;
CREATE TRIGGER platform_staff_access_changed
AFTER UPDATE OF staff_role, is_active, revision, otp_email ON platform_staff_members
WHEN OLD.staff_role <> NEW.staff_role OR OLD.is_active <> NEW.is_active
  OR OLD.revision <> NEW.revision OR OLD.otp_email IS NOT NEW.otp_email
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.user_id;
  DELETE FROM platform_staff_email_challenges WHERE user_id = NEW.user_id;
END;

DROP TRIGGER platform_staff_account_inactive;
CREATE TRIGGER platform_staff_account_inactive
AFTER UPDATE OF is_active ON users
WHEN COALESCE(OLD.is_active, 1) <> COALESCE(NEW.is_active, 1)
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
  DELETE FROM platform_staff_email_challenges WHERE user_id = NEW.id;
END;

DROP TRIGGER platform_staff_password_changed;
CREATE TRIGGER platform_staff_password_changed
AFTER UPDATE OF password_hash ON users
WHEN OLD.password_hash IS NOT NEW.password_hash
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
  DELETE FROM platform_staff_email_challenges WHERE user_id = NEW.id;
END;

CREATE TRIGGER platform_staff_account_email_changed
AFTER UPDATE OF email ON users
WHEN OLD.email IS NOT NEW.email
BEGIN
  DELETE FROM platform_staff_step_up WHERE user_id = NEW.id;
  DELETE FROM platform_staff_email_challenges WHERE user_id = NEW.id;
END;

-- Also audit explicit operator updates without impersonating the staff identity.
CREATE TRIGGER platform_staff_verification_email_changed
AFTER UPDATE OF otp_email ON platform_staff_members
WHEN OLD.otp_email IS NOT NEW.otp_email
BEGIN
  INSERT INTO platform_staff_audit (id, actor_user_id, target_user_id, action, reason, created_at)
  VALUES (lower(hex(randomblob(16))), NULL, NEW.user_id, 'staff_verification_email_updated',
    'Staff verification address updated; previous verification invalidated', unixepoch());
END;
