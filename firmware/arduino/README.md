# Crimini temperature radio (Arduino IDE)

Open `CriminiTemperature/CriminiTemperature.ino` in Arduino IDE. Use the Espressif ESP32 board package, version 3.3.10 (the version compiled in this repository), and select **ESP32C6 Dev Module**. No third-party sensor library is needed.

## Prepare devices

1. Run `node firmware/arduino/tools/provision-manifest.mjs --gateways=1 --nodes=4` from the repo root. Keep `firmware/arduino/generated/` private. The script assigns random unique serials and keys; it will not register hardware by itself.
2. Apply `generated/iot_inventory.sql` to the intended D1 database. Check that the inserted inventory rows are correct before claiming devices in the app.
3. For each sensor, copy its generated `sensor-*-*.h` to the sketch folder as `CriminiLocalConfig.h`. TNY v1.1 wiring is VDD to 3.3V, GND to G, SDA to GPIO18, and SCL to GPIO19. Set the optional battery-divider pin only if wired. Upload that sketch to that one sensor.
4. Copy the gateway's generated `gateway-*.h` to the sketch folder as `CriminiLocalConfig.h`. The current gateway uses the same ESP32-C6 board. Fill Wi-Fi and the current trusted root CA PEM, then upload. The generated known-node table must contain the matching sensor serials and secrets. A future ESP32-C6-WROOM-1U gateway requires antenna and RF validation, not a guessed firmware change.
5. In the app, register the gateway serial and its nodes with their assigned serials. The gateway authenticates to `/api/temps`; nodes never receive Wi-Fi or cloud credentials.

For an IDE compile check before provisioning, copy `CriminiLocalConfig.example.h` to `CriminiLocalConfig.h`. Its empty identity and pin values deliberately disable transmission. `CriminiLocalConfig.h` and `generated/` are git-ignored.

The sensor uses raw IEEE 802.15.4 on channel 20 and a short HMAC-SHA256 signed packet, then deep sleeps for five minutes plus up to 20 seconds jitter. AHT20 supplies temperature and humidity. BMP280 is only probed; pressure is not sent. Battery millivolts are omitted unless a measured divider is configured. The gateway validates node identity and signature before HTTPS upload.

The gateway buffers failed uploads in RAM. An extended Wi-Fi outage can fill that buffer, and a gateway power loss discards unsent readings. Verify the actual sensor GPIO wiring and measured deep-sleep current before battery testing.

The 0 dBm, CCA-enabled, three-burst radio profile is a conservative starting configuration. Final antenna, enclosure, power, channel plan, duty cycle, and regulatory compliance must be measured on the assembled hardware. Do not ship based on a successful compile alone.
