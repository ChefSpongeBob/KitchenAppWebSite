-- Review bookkeeping only. This migration does not delete or expire customer records.
ALTER TABLE account_deletion_requests ADD COLUMN review_revision INTEGER NOT NULL DEFAULT 1 CHECK (review_revision > 0);

DROP INDEX idx_account_deletion_requests_status_created;
CREATE INDEX idx_account_deletion_requests_status_created
  ON account_deletion_requests(status, created_at, id);
CREATE INDEX idx_account_deletion_requests_created
  ON account_deletion_requests(created_at, id);
