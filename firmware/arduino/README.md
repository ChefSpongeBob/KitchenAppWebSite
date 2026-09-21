# Crimini temperature firmware

The firmware is two normal Arduino IDE sketches:

- `CriminiTempNode/CriminiTempNode.ino`: set `NODE_SERIAL`, then upload it to each sensor.
- `CriminiTempGateway/CriminiTempGateway.ino`: set `GATEWAY_SERIAL`, Wi-Fi, and its factory-installed credential, then upload it to the gateway.

Select **ESP32C6 Dev Module** from Espressif's Arduino ESP32 package. The node uses SDA GPIO18 and SCL GPIO19, reads temperature and humidity from the AHT20, sends three short IEEE 802.15.4 bursts, and deep-sleeps for five minutes plus a small random delay. Pressure is not used.

Use lowercase serials with letters, numbers, hyphens, or underscores, up to 31 characters. At the factory, record the gateway serial and the hash of that same credential in the private gateway inventory. Customers register only the gateway serial in Crimini, then each node serial under that gateway. There is no generator, manifest, copied configuration header, or node key. Never commit a filled-in gateway credential to the repository.
