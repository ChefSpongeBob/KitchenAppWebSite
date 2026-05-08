-- Billing, trial, and tenant lifecycle hardening.

CREATE TABLE IF NOT EXISTS trial_identity_claims (
  identity_key TEXT PRIMARY KEY,
  identity_type TEXT NOT NULL,
  identity_hash TEXT NOT NULL,
  business_id TEXT,
  user_id TEXT,
  source TEXT NOT NULL DEFAULT 'trial_granted',
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trial_identity_claims_business
ON trial_identity_claims(business_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_trial_identity_claims_type_hash
ON trial_identity_claims(identity_type, identity_hash, status);

CREATE TABLE IF NOT EXISTS business_lifecycle_snapshots (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  requested_by_user_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  table_counts_json TEXT NOT NULL,
  business_json TEXT,
  trial_json TEXT,
  billing_json TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_business_lifecycle_snapshots_business
ON business_lifecycle_snapshots(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_lifecycle_snapshots_requested_by
ON business_lifecycle_snapshots(requested_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_businesses_status_updated
ON businesses(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_trials_status_updated
ON business_trials(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_trials_owner_status
ON business_trials(owner_user_id, status, updated_at DESC);

UPDATE businesses
SET status = 'trialing'
WHERE id IN (
  SELECT business_id
  FROM business_trials
  WHERE status = 'trialing'
)
AND COALESCE(status, 'active') = 'active';

UPDATE businesses
SET status = 'active'
WHERE id IN (
  SELECT business_id
  FROM business_trials
  WHERE status = 'paid'
);

UPDATE businesses
SET status = 'past_due'
WHERE id IN (
  SELECT business_id
  FROM business_trials
  WHERE status = 'pending_payment'
)
AND COALESCE(status, 'active') IN ('active', 'trialing');
