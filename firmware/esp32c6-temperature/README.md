# Crimini ESP32-C6 Temperature Firmware

Contained legacy/prototype firmware workspace for Crimini temperature gateways and ESP32-C6FH4 AHT20/BMP280 radio sensor nodes.

Production target:
- Sensor nodes use a raw IEEE 802.15.4 star link to send short signed temperature/humidity bursts to a Crimini gateway.
- The gateway is the only device with Wi-Fi/API credentials. Nodes never talk directly to the app or Cloudflare.
- Each node burst should include its factory serial, sequence, wake nonce, temperature, humidity, battery voltage, and HMAC.
- The gateway adds receiver metadata such as RSSI/LQI before posting batches to `/api/temps`.

Current source status:
- `src/sensor_node.cpp` and `src/gateway.cpp` are the ESP-NOW prototype from the earlier hardware design.
- Keep them as reference only until the next pass replaces radio send/receive with the ESP32-C6 IEEE 802.15.4 implementation.
- The production firmware track now lives in `../esp32c6-temperature-idf`.

Flow:
1. Generate factory serials and SQL:
   `node tools/provision-manifest.mjs --prefix=crimini --gateways=1 --nodes=4`
2. Apply `generated/iot_inventory.sql` to `crimini-production`.
3. Copy `include/crimini_iot_config.example.h` to `include/crimini_iot_config.h`.
4. Fill Wi-Fi, API, TLS root CA, radio channel/PAN ID, gateway key, and node secrets from `generated/factory_manifest.json`.
5. Build either `gateway` or `sensor-node` with PlatformIO.

Notes:
- Sensor nodes read AHT20 temperature/humidity, then send short radio bursts only to the configured gateway network.
- BMP280 is initialized for board validation, but pressure is not transmitted or stored.
- Packets are HMAC-SHA256 signed with per-node secrets.
- Gateway posts batches to `/api/temps` using the app's gateway device credentials.
- Keep TX power, antenna, channel, enclosure, and shipped module choice aligned with the certified module design and final FCC testing.
