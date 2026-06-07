UPDATE store_products
SET price_cents = CASE product_id
  WHEN 'crimini.plan.small.monthly' THEN 3000
  WHEN 'crimini.plan.medium.monthly' THEN 6500
  WHEN 'crimini.plan.large.monthly' THEN 9000
  ELSE price_cents
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
WHERE product_id = 'crimini.addon.cameras.monthly';

UPDATE store_products
SET addon_camera_monitoring = 0,
updated_at = strftime('%s','now')
WHERE product_id = 'crimini.plan.large.monthly';
