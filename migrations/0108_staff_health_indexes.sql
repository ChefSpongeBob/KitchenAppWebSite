-- Bounded, business-scoped staff reads without sorting an entire delivery history.
CREATE INDEX IF NOT EXISTS idx_operational_events_staff_queue
  ON operational_events(business_id, delivery_status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_operational_attempts_staff_recent
  ON operational_event_delivery_attempts(business_id, attempted_at DESC, id DESC);
