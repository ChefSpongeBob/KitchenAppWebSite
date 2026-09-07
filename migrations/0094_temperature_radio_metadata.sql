ALTER TABLE temps ADD COLUMN packet_sequence INTEGER;

ALTER TABLE temps ADD COLUMN wake_nonce TEXT;

ALTER TABLE temps ADD COLUMN lqi INTEGER;

ALTER TABLE temperature_sensor_nodes ADD COLUMN packet_sequence INTEGER;

ALTER TABLE temperature_sensor_nodes ADD COLUMN wake_nonce TEXT;

ALTER TABLE temperature_sensor_nodes ADD COLUMN lqi INTEGER;

CREATE INDEX IF NOT EXISTS idx_temps_business_sensor_sequence
  ON temps(business_id, sensor_id, packet_sequence);

CREATE INDEX IF NOT EXISTS idx_temps_business_sensor_nonce
  ON temps(business_id, sensor_id, wake_nonce);
