CREATE INDEX IF NOT EXISTS idx_temps_sensor_ts_desc
  ON temps(sensor_id, ts DESC);
