# Crimini ESP32-C6 Temperature Firmware

Contained firmware workspace for Crimini temperature gateways and radio sensor nodes.

Flow:
1. Generate factory serials and SQL:
   `node tools/provision-manifest.mjs --prefix=crimini --gateways=1 --nodes=4`
2. Apply `generated/iot_inventory.sql` to `crimini-production`.
3. Copy `include/crimini_iot_config.example.h` to `include/crimini_iot_config.h`.
4. Fill Wi-Fi, API, TLS root CA, gateway MAC, gateway key, and node secrets from `generated/factory_manifest.json`.
5. Build either `gateway` or `sensor-node` with PlatformIO.

Notes:
- Sensor nodes send ESP-NOW packets only to the configured gateway MAC.
- Packets are HMAC-SHA256 signed with per-node secrets.
- Gateway posts batches to `/api/temps` using the app's gateway device credentials.
- Keep TX power, antenna, channel, and enclosure aligned with the certified module design and final FCC testing.
