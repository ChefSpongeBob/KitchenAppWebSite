UPDATE store_products
SET addon_temp_monitoring = CASE plan_tier
  WHEN 'growth' THEN 1
  WHEN 'enterprise' THEN 1
  ELSE 0
END,
updated_at = strftime('%s','now')
WHERE product_id IN (
  'crimini.plan.small.monthly',
  'crimini.plan.medium.monthly',
  'crimini.plan.large.monthly'
);

UPDATE store_products
SET active = 0,
updated_at = strftime('%s','now')
WHERE product_id = 'crimini.addon.temps.monthly';

UPDATE businesses
SET addon_temp_monitoring = CASE plan_tier
  WHEN 'growth' THEN 1
  WHEN 'enterprise' THEN 1
  ELSE 0
END,
updated_at = strftime('%s','now');

UPDATE store_billing_placeholders
SET addon_temp_monitoring = CASE plan_tier
  WHEN 'growth' THEN 1
  WHEN 'enterprise' THEN 1
  ELSE 0
END,
updated_at = strftime('%s','now');
