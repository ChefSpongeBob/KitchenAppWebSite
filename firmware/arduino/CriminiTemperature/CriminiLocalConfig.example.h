#pragma once

// Copy to CriminiLocalConfig.h. Use one copy per flashed device.
// 0 = AA-powered sensor node, 1 = mains-powered gateway.
#define CRIMINI_ROLE_GATEWAY 0

// Same channel/PAN on a gateway and its nodes. Validate channel and antenna
// choice on the final product before sale. 0 dBm is a conservative starting point.
#define CRIMINI_RADIO_CHANNEL 20
#define CRIMINI_RADIO_PAN_ID 0xC110
#define CRIMINI_RADIO_TX_POWER_DBM 0
#define CRIMINI_GATEWAY_SHORT_ADDR 0x0001
#define CRIMINI_NODE_SHORT_ADDR 0x1001

// TNY v1.1 wiring: sensor VDD to 3.3V, GND to G, SDA to GPIO18, SCL to GPIO19.
#define CRIMINI_I2C_SDA_GPIO 18
#define CRIMINI_I2C_SCL_GPIO 19
#define CRIMINI_SENSOR_POWER_GPIO -1  // Sensor VDD is always powered from 3.3V.
#define CRIMINI_AHT20_ADDRESS 0x38
#define CRIMINI_BMP280_ADDRESS 0x77

#define CRIMINI_SENSOR_WAKE_SECONDS 300
#define CRIMINI_SENSOR_JITTER_SECONDS 20
#define CRIMINI_SENSOR_BURSTS 3
#define CRIMINI_SENSOR_BURST_SPACING_MS 180

// Set only when a measured battery divider is connected. Otherwise battery_mV=0.
#define CRIMINI_BATTERY_ADC_GPIO -1
#define CRIMINI_BATTERY_DIVIDER_RATIO 1.0f

// Factory identity: never reuse a serial/secret pair on another node.
#define CRIMINI_NODE_SERIAL ""
#define CRIMINI_NODE_SECRET ""

// Gateway-only settings. The node never uses Wi-Fi or an API credential.
#define CRIMINI_WIFI_SSID ""
#define CRIMINI_WIFI_PASSWORD ""
#define CRIMINI_API_BASE_URL "https://criminiops.com"
#define CRIMINI_GATEWAY_SERIAL ""
#define CRIMINI_GATEWAY_DEVICE_KEY ""

// PEM for the root CA currently trusted by the production API certificate.
// The gateway refuses to post with this empty. Never use setInsecure().
#define CRIMINI_TLS_ROOT_CA_PEM ""

struct CriminiKnownNode {
  const char* serial;
  const char* secret;
};

static const CriminiKnownNode CRIMINI_KNOWN_NODES[] = {
  { "", "" }
};
