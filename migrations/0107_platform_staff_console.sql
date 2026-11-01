-- Platform authority is independent of restaurant membership and subscription.
CREATE TABLE IF NOT EXISTS platform_staff_members (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  staff_role TEXT NOT NULL CHECK (staff_role IN ('owner', 'support', 'equipment')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_staff_audit (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  business_id TEXT,
  device_serial TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_platform_staff_audit_created ON platform_staff_audit(created_at DESC, id);

CREATE TRIGGER IF NOT EXISTS platform_staff_members_insert_audit
AFTER INSERT ON platform_staff_members
BEGIN
  INSERT INTO platform_staff_audit (id, actor_user_id, action, reason, created_at)
  VALUES (lower(hex(randomblob(16))), COALESCE(NEW.granted_by, NEW.user_id),
    CASE WHEN NEW.granted_by IS NULL AND NEW.staff_role = 'owner'
      THEN 'platform_owner_bootstrapped' ELSE 'staff_membership_added' END,
    'Explicit operator-approved platform membership', NEW.created_at);
END;

CREATE TABLE IF NOT EXISTS iot_device_reservations (
  serial TEXT PRIMARY KEY REFERENCES iot_device_inventory(serial) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reserved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iot_reservations_business ON iot_device_reservations(business_id, serial);
CREATE INDEX IF NOT EXISTS idx_businesses_staff_name ON businesses(name COLLATE NOCASE, id);

-- Enforce reservations even if two registrations race or use an older app worker.
CREATE TRIGGER IF NOT EXISTS iot_gateway_reservation_insert
BEFORE INSERT ON iot_devices
WHEN NEW.device_type = 'sensor_gateway' AND EXISTS (
  SELECT 1 FROM iot_device_reservations r
  WHERE r.serial = NEW.external_device_id AND r.business_id <> NEW.business_id
)
BEGIN SELECT RAISE(ABORT, 'Gateway is reserved for another business.'); END;

CREATE TRIGGER IF NOT EXISTS iot_gateway_reservation_update
BEFORE UPDATE OF business_id, external_device_id, is_active ON iot_devices
WHEN NEW.device_type = 'sensor_gateway' AND EXISTS (
  SELECT 1 FROM iot_device_reservations r
  WHERE r.serial = NEW.external_device_id AND r.business_id <> NEW.business_id
)
BEGIN SELECT RAISE(ABORT, 'Gateway is reserved for another business.'); END;

CREATE TRIGGER IF NOT EXISTS iot_reservation_available_insert
BEFORE INSERT ON iot_device_reservations
WHEN NOT EXISTS (
  SELECT 1 FROM iot_device_inventory i
  WHERE i.serial = NEW.serial AND i.device_type = 'sensor_gateway'
    AND i.claim_status = 'available' AND i.claimed_business_id IS NULL
    AND i.claimed_iot_device_id IS NULL
) OR EXISTS (SELECT 1 FROM iot_devices d WHERE d.external_device_id = NEW.serial)
BEGIN SELECT RAISE(ABORT, 'Only unclaimed gateways can be reserved.'); END;

CREATE TRIGGER IF NOT EXISTS iot_reservation_no_reassignment
BEFORE UPDATE ON iot_device_reservations
BEGIN SELECT RAISE(ABORT, 'Release the reservation before reassigning it.'); END;
