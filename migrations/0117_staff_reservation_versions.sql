-- A release must refer to the reservation shown, not a later use of the serial.
ALTER TABLE iot_device_reservations ADD COLUMN reservation_id TEXT;
UPDATE iot_device_reservations SET reservation_id = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX idx_iot_reservation_version ON iot_device_reservations(reservation_id);

-- Older application versions can still insert reservations during rollout/rollback.
CREATE TRIGGER iot_reservation_assign_version
AFTER INSERT ON iot_device_reservations
WHEN NEW.reservation_id IS NULL
BEGIN
  UPDATE iot_device_reservations SET reservation_id = lower(hex(randomblob(16))) WHERE serial = NEW.serial;
END;

CREATE TRIGGER iot_reservation_version_immutable
BEFORE UPDATE OF reservation_id ON iot_device_reservations
WHEN OLD.reservation_id IS NOT NULL AND NEW.reservation_id IS NOT OLD.reservation_id
BEGIN SELECT RAISE(ABORT, 'Release the reservation before replacing its version.'); END;
