# Crimini ESP32-C6FH4 Temperature Firmware

Production firmware path for Crimini temperature monitoring hardware.

## Architecture

- Sensor node: ESP32-C6FH4 + AHT20/BMP280, AA battery, deep sleep.
- Gateway: ESP32-C6, mains powered, receives raw IEEE 802.15.4 bursts and posts to Crimini.
- Radio: raw IEEE 802.15.4 star network, short packets, HMAC-SHA256 at the app payload layer.
- Cloud access: gateway only. Sensor nodes never receive Wi-Fi credentials or Cloudflare/API credentials.
- App ingest: `POST /api/temps` with `x-device-id` and `x-device-key`.

## Build Setup

Install ESP-IDF, then from this folder:

```sh
idf.py set-target esp32c6
```

Gateway build:

```sh
idf.py -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.gateway.defaults" build
```

Sensor node build:

```sh
idf.py -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.sensor-node.defaults" build
```

Flash:

```sh
idf.py -p COM_PORT flash monitor
```

## Configuration

Copy `main/crimini_config.example.h` to `main/crimini_config.h`.

Fill:

- `CRIMINI_WIFI_SSID`
- `CRIMINI_WIFI_PASSWORD`
- `CRIMINI_TLS_ROOT_CA_PEM`
- `CRIMINI_GATEWAY_SERIAL`
- `CRIMINI_GATEWAY_DEVICE_KEY`
- `CRIMINI_NODE_SERIAL`
- `CRIMINI_NODE_SHARED_SECRET`
- `CRIMINI_KNOWN_NODES`

`main/crimini_config.h` is ignored by git.

## Factory Provisioning

Generate serials and secrets from the existing tool:

```sh
node ../esp32c6-temperature/tools/provision-manifest.mjs --prefix=crimini --gateways=1 --nodes=4
```

Apply the generated SQL to D1 inventory before customer registration.

## Power/Radio Notes

- Nodes send multiple short bursts per wake and immediately deep sleep.
- Gateway suppresses duplicate bursts by node serial, sequence, and wake nonce.
- Gateway pauses 802.15.4 receive while posting over Wi-Fi because ESP32-C6 has one 2.4 GHz RF path.
- TX power is configured in dBm by `CRIMINI_RADIO_TX_POWER_DBM`; keep this conservative until final antenna/enclosure/FCC validation.
