CREATE TABLE IF NOT EXISTS waste_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  submitted_by_user_id TEXT NOT NULL,
  product TEXT NOT NULL,
  amount REAL,
  unit TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_business_created
  ON waste_logs(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waste_logs_business_user_created
  ON waste_logs(business_id, submitted_by_user_id, created_at DESC);
