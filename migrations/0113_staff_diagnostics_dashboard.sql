CREATE TABLE platform_diagnostic_issues (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  route_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('server_error', 'access_denied', 'slow_request')),
  status INTEGER NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  max_duration_ms INTEGER NOT NULL,
  last_request_id TEXT NOT NULL
);
CREATE INDEX idx_platform_issues_recent ON platform_diagnostic_issues(last_seen_at DESC, id DESC);
CREATE INDEX idx_platform_issues_business_recent ON platform_diagnostic_issues(business_id, last_seen_at DESC, id DESC);
CREATE INDEX idx_platform_issues_kind_recent ON platform_diagnostic_issues(kind, last_seen_at DESC, id DESC);
CREATE INDEX idx_platform_issues_area_recent ON platform_diagnostic_issues(area, last_seen_at DESC, id DESC);

CREATE TABLE platform_request_metrics (
  scope_key TEXT NOT NULL,
  business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  bucket INTEGER NOT NULL,
  success_samples INTEGER NOT NULL DEFAULT 0,
  sample_duration_ms INTEGER NOT NULL DEFAULT 0,
  sample_max_ms INTEGER NOT NULL DEFAULT 0,
  server_errors INTEGER NOT NULL DEFAULT 0,
  access_denials INTEGER NOT NULL DEFAULT 0,
  slow_requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope_key, bucket),
  CHECK ((scope_key = 'platform' AND business_id IS NULL)
    OR (business_id IS NOT NULL AND scope_key = 'business:' || business_id))
);
CREATE INDEX idx_platform_metrics_expiry ON platform_request_metrics(bucket);
CREATE INDEX idx_platform_metrics_business ON platform_request_metrics(business_id, bucket);
CREATE INDEX idx_staff_audit_business_recent ON platform_staff_audit(business_id, created_at DESC, id DESC);
CREATE INDEX idx_account_audit_staff_recent ON account_audit_logs(business_id, created_at DESC, id DESC);
CREATE INDEX idx_announcement_staff_recent ON announcement_history(business_id, created_at DESC, id DESC);
CREATE INDEX idx_gateway_staff_contact ON iot_devices(COALESCE(last_seen_at, 0), id)
  WHERE device_type = 'sensor_gateway' AND is_active = 1 AND revoked_at IS NULL;
