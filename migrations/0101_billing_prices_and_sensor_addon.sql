-- Align the native store catalog with the approved monthly pricing.
UPDATE store_products
SET price_cents = CASE product_id
  WHEN 'crimini.plan.small.monthly' THEN 2900
  WHEN 'crimini.plan.medium.monthly' THEN 4900
  WHEN 'crimini.plan.large.monthly' THEN 6900
  ELSE price_cents
END,
addon_temp_monitoring = 0,
updated_at = strftime('%s','now')
WHERE product_id IN (
  'crimini.plan.small.monthly',
  'crimini.plan.medium.monthly',
  'crimini.plan.large.monthly'
);

UPDATE store_products
SET display_name = 'Temperature Monitoring - Up to 12 Sensors',
    entitlement_key = 'addon_temp_monitoring',
    plan_tier = NULL,
    billing_period = 'monthly',
    price_cents = 1700,
    currency = 'USD',
    addon_temp_monitoring = 1,
    addon_camera_monitoring = 0,
    active = 1,
    updated_at = strftime('%s','now')
WHERE product_id = 'crimini.addon.temps.monthly';

-- Plan purchases no longer grant temperature monitoring by themselves.
UPDATE business_store_entitlements
SET addon_temp_monitoring = 0,
    updated_at = strftime('%s','now')
WHERE product_id IN (
  'crimini.plan.small.monthly',
  'crimini.plan.medium.monthly',
  'crimini.plan.large.monthly'
);

UPDATE store_billing_placeholders
SET addon_temp_monitoring = 0,
    updated_at = strftime('%s','now')
WHERE addon_temp_monitoring <> 0;
