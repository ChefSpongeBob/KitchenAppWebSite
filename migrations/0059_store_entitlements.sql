CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  entitlement_key TEXT NOT NULL,
  plan_tier TEXT,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  addon_temp_monitoring INTEGER NOT NULL DEFAULT 0,
  addon_camera_monitoring INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(store, product_id)
);

CREATE INDEX IF NOT EXISTS idx_store_products_store_active
  ON store_products(store, active);

CREATE TABLE IF NOT EXISTS business_store_entitlements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  entitlement_key TEXT NOT NULL,
  plan_tier TEXT,
  addon_temp_monitoring INTEGER NOT NULL DEFAULT 0,
  addon_camera_monitoring INTEGER NOT NULL DEFAULT 0,
  purchase_token_hash TEXT,
  original_transaction_id TEXT,
  latest_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  current_period_start INTEGER,
  current_period_end INTEGER,
  auto_renewing INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER,
  expires_at INTEGER,
  raw_payload_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(business_id, store, product_id)
);

CREATE INDEX IF NOT EXISTS idx_business_store_entitlements_business_status
  ON business_store_entitlements(business_id, status);

CREATE INDEX IF NOT EXISTS idx_business_store_entitlements_token
  ON business_store_entitlements(store, purchase_token_hash);

CREATE TABLE IF NOT EXISTS store_purchase_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  purchase_token_hash TEXT,
  original_transaction_id TEXT,
  transaction_id TEXT,
  event_type TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  raw_payload_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_store_purchase_events_business
  ON store_purchase_events(business_id, created_at);

CREATE INDEX IF NOT EXISTS idx_store_purchase_events_token
  ON store_purchase_events(store, purchase_token_hash);

CREATE TABLE IF NOT EXISTS store_webhook_events (
  id TEXT PRIMARY KEY,
  store TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_status TEXT NOT NULL DEFAULT 'pending',
  raw_payload_json TEXT,
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  UNIQUE(store, event_id)
);

CREATE INDEX IF NOT EXISTS idx_store_webhook_events_status
  ON store_webhook_events(store, processed_status, created_at);

INSERT INTO store_products (
  id, store, product_id, display_name, entitlement_key, plan_tier,
  price_cents, addon_temp_monitoring, addon_camera_monitoring,
  created_at, updated_at
)
VALUES
  ('google_play:crimini.plan.small.monthly', 'google_play', 'crimini.plan.small.monthly', 'Small Monthly', 'plan_small', 'starter', 5000, 0, 0, strftime('%s','now'), strftime('%s','now')),
  ('google_play:crimini.plan.medium.monthly', 'google_play', 'crimini.plan.medium.monthly', 'Medium Monthly', 'plan_medium', 'growth', 12000, 0, 0, strftime('%s','now'), strftime('%s','now')),
  ('google_play:crimini.plan.large.monthly', 'google_play', 'crimini.plan.large.monthly', 'Large Monthly', 'plan_large', 'enterprise', 16000, 1, 1, strftime('%s','now'), strftime('%s','now')),
  ('google_play:crimini.addon.temps.monthly', 'google_play', 'crimini.addon.temps.monthly', 'Temperature Monitoring', 'addon_temp_monitoring', NULL, 3000, 1, 0, strftime('%s','now'), strftime('%s','now')),
  ('google_play:crimini.addon.cameras.monthly', 'google_play', 'crimini.addon.cameras.monthly', 'Camera Monitoring', 'addon_camera_monitoring', NULL, 3000, 0, 1, strftime('%s','now'), strftime('%s','now')),
  ('app_store:crimini.plan.small.monthly', 'app_store', 'crimini.plan.small.monthly', 'Small Monthly', 'plan_small', 'starter', 5000, 0, 0, strftime('%s','now'), strftime('%s','now')),
  ('app_store:crimini.plan.medium.monthly', 'app_store', 'crimini.plan.medium.monthly', 'Medium Monthly', 'plan_medium', 'growth', 12000, 0, 0, strftime('%s','now'), strftime('%s','now')),
  ('app_store:crimini.plan.large.monthly', 'app_store', 'crimini.plan.large.monthly', 'Large Monthly', 'plan_large', 'enterprise', 16000, 1, 1, strftime('%s','now'), strftime('%s','now')),
  ('app_store:crimini.addon.temps.monthly', 'app_store', 'crimini.addon.temps.monthly', 'Temperature Monitoring', 'addon_temp_monitoring', NULL, 3000, 1, 0, strftime('%s','now'), strftime('%s','now')),
  ('app_store:crimini.addon.cameras.monthly', 'app_store', 'crimini.addon.cameras.monthly', 'Camera Monitoring', 'addon_camera_monitoring', NULL, 3000, 0, 1, strftime('%s','now'), strftime('%s','now'))
ON CONFLICT(store, product_id) DO UPDATE SET
  display_name = excluded.display_name,
  entitlement_key = excluded.entitlement_key,
  plan_tier = excluded.plan_tier,
  price_cents = excluded.price_cents,
  addon_temp_monitoring = excluded.addon_temp_monitoring,
  addon_camera_monitoring = excluded.addon_camera_monitoring,
  active = 1,
  updated_at = strftime('%s','now');
