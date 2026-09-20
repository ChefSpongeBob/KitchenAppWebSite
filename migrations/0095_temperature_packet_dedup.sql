-- A signed node packet is accepted at most once per business and sensor.
CREATE UNIQUE INDEX IF NOT EXISTS idx_temps_business_sensor_packet_unique
  ON temps(business_id, sensor_id, packet_sequence, wake_nonce)
  WHERE packet_sequence IS NOT NULL AND wake_nonce IS NOT NULL;
