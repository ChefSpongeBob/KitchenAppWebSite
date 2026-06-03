CREATE UNIQUE INDEX IF NOT EXISTS idx_iot_devices_external_device_unique
ON iot_devices(external_device_id);
