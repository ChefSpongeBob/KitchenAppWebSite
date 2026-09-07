#pragma once

// Copy to crimini_config.h and fill production values. Do not commit real secrets.

#define CRIMINI_RADIO_CHANNEL 20
#define CRIMINI_RADIO_PAN_ID 0xC110
#define CRIMINI_GATEWAY_SHORT_ADDR 0x0001
#define CRIMINI_SENSOR_SHORT_ADDR 0x1001
#define CRIMINI_RADIO_TX_POWER_DBM 0

#define CRIMINI_SENSOR_WAKE_SECONDS 300
#define CRIMINI_SENSOR_WAKE_JITTER_SECONDS 20
#define CRIMINI_SENSOR_BURST_COUNT 3
#define CRIMINI_SENSOR_BURST_SPACING_MS 180

#define CRIMINI_I2C_PORT I2C_NUM_0
#define CRIMINI_I2C_SDA_GPIO 6
#define CRIMINI_I2C_SCL_GPIO 7
#define CRIMINI_I2C_CLOCK_HZ 100000
#define CRIMINI_AHT20_ADDRESS 0x38
#define CRIMINI_BMP280_ADDRESS 0x77

// Leave unset until the battery divider has final resistor values.
// #define CRIMINI_BATTERY_MV_FIXED 3000

#define CRIMINI_WIFI_SSID ""
#define CRIMINI_WIFI_PASSWORD ""
#define CRIMINI_API_BASE_URL "https://criminiops.com"
#define CRIMINI_GATEWAY_SERIAL "crimini-gateway-0001"
#define CRIMINI_GATEWAY_DEVICE_KEY "replace_from_factory_manifest"
#define CRIMINI_OPTIONAL_BUSINESS_ID ""
#define CRIMINI_GATEWAY_QUEUE_DEPTH 32
#define CRIMINI_GATEWAY_POST_INTERVAL_MS 10000
#define CRIMINI_GATEWAY_WIFI_TIMEOUT_MS 15000

// Paste the production root CA. The gateway refuses HTTPS posts without it unless
// CRIMINI_ALLOW_INSECURE_TLS_FOR_CONTROLLED_VALIDATION is explicitly defined.
#define CRIMINI_TLS_ROOT_CA_PEM ""
// #define CRIMINI_ALLOW_INSECURE_TLS_FOR_CONTROLLED_VALIDATION 1

#define CRIMINI_NODE_SERIAL "crimini-sensor-0001"
#define CRIMINI_NODE_SHARED_SECRET "replace_from_factory_manifest"

typedef struct {
  const char* serial;
  const char* secret;
} crimini_known_node_t;

static const crimini_known_node_t CRIMINI_KNOWN_NODES[] = {
  { "crimini-sensor-0001", "replace_from_factory_manifest" }
};
