-- Sensor node display names for temperatures.

CREATE TABLE IF NOT EXISTS sensor_nodes (
  sensor_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
