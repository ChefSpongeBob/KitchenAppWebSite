DELETE FROM business_store_entitlements
WHERE entitlement_key = 'addon_camera_monitoring'
   OR product_id LIKE '%.addon.cameras.%';

UPDATE business_store_entitlements
SET addon_camera_monitoring = 0
WHERE addon_camera_monitoring <> 0;

DELETE FROM store_products
WHERE entitlement_key = 'addon_camera_monitoring'
   OR product_id LIKE '%.addon.cameras.%';

UPDATE store_products
SET addon_camera_monitoring = 0
WHERE addon_camera_monitoring <> 0;

UPDATE businesses
SET addon_camera_monitoring = 0
WHERE addon_camera_monitoring <> 0;

UPDATE store_billing_placeholders
SET addon_camera_monitoring = 0
WHERE addon_camera_monitoring <> 0;

DELETE FROM iot_devices
WHERE device_type = 'camera';

DROP TABLE IF EXISTS camera_events;
DROP TABLE IF EXISTS camera_sources;
