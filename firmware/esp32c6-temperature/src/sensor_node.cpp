#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#if __has_include("crimini_iot_config.h")
#include "crimini_iot_config.h"
#else
#error "Copy include/crimini_iot_config.example.h to include/crimini_iot_config.h and fill device values."
#endif

#include "crimini_iot_protocol.h"

#if CRIMINI_USE_DS18B20
#include <OneWire.h>
#include <DallasTemperature.h>
OneWire oneWire(CRIMINI_DS18B20_PIN);
DallasTemperature tempBus(&oneWire);
#endif

RTC_DATA_ATTR uint32_t bootSequence = 0;

static uint8_t gatewayMac[] = CRIMINI_GATEWAY_MAC;

static void configureRadio() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);

  wifi_country_t country = {"US", 1, 11, WIFI_COUNTRY_POLICY_MANUAL};
  esp_wifi_set_country(&country);
  esp_wifi_set_channel(CRIMINI_ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_max_tx_power(CRIMINI_TX_POWER_QDBM);
}

static float readTemperatureF() {
#if CRIMINI_USE_DS18B20
  tempBus.begin();
  tempBus.requestTemperatures();
  const float tempC = tempBus.getTempCByIndex(0);
  if (tempC <= -126.0f || tempC >= 125.0f) return NAN;
  return tempC * 9.0f / 5.0f + 32.0f;
#else
#error "Define a real temperature source before building production sensor firmware."
#endif
}

static uint16_t readBatteryMv() {
#ifdef CRIMINI_BATTERY_ADC_PIN
  const int raw = analogRead(CRIMINI_BATTERY_ADC_PIN);
  const float mv = (static_cast<float>(raw) / 4095.0f) * 3300.0f * CRIMINI_BATTERY_DIVIDER_RATIO;
  return static_cast<uint16_t>(max(0.0f, min(65535.0f, mv)));
#else
  return 0;
#endif
}

static bool initEspNow() {
  if (esp_now_init() != ESP_OK) return false;

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, gatewayMac, 6);
  peer.channel = CRIMINI_ESPNOW_CHANNEL;
  peer.encrypt = false;

  if (!esp_now_is_peer_exist(gatewayMac)) {
    return esp_now_add_peer(&peer) == ESP_OK;
  }
  return true;
}

static bool sendReading(float tempF, uint16_t batteryMv) {
  CriminiTempPacket packet = {};
  packet.magic = CRIMINI_PACKET_MAGIC;
  packet.version = CRIMINI_PACKET_VERSION;
  packet.packetType = CRIMINI_PACKET_TYPE_TEMP;
  packet.sequence = bootSequence;
  packet.uptimeSeconds = millis() / 1000;
  criminiCopySerial(packet.nodeSerial, CRIMINI_NODE_SERIAL);
  packet.tempCentiF = static_cast<int32_t>(roundf(tempF * 100.0f));
  packet.batteryMv = batteryMv;
  packet.packetRssi = 0;

  if (!criminiSignPacket(packet, CRIMINI_NODE_SHARED_SECRET)) return false;
  return esp_now_send(gatewayMac, reinterpret_cast<uint8_t*>(&packet), sizeof(packet)) == ESP_OK;
}

static void sleepUntilNextReading() {
  const uint32_t jitter = esp_random() % (CRIMINI_SENSOR_RANDOM_JITTER_SECONDS + 1);
  const uint64_t sleepSeconds = CRIMINI_SENSOR_INTERVAL_SECONDS + jitter;
  esp_sleep_enable_timer_wakeup(sleepSeconds * 1000000ULL);
  Serial.printf("Sleeping %llu seconds\n", sleepSeconds);
  Serial.flush();
  esp_deep_sleep_start();
}

void setup() {
  Serial.begin(115200);
  delay(250);
  bootSequence++;

  configureRadio();
  if (!initEspNow()) {
    Serial.println("ESP-NOW init failed");
    sleepUntilNextReading();
  }

  const float tempF = readTemperatureF();
  if (!isfinite(tempF)) {
    Serial.println("Temperature probe read failed");
    sleepUntilNextReading();
  }

  const uint16_t batteryMv = readBatteryMv();
  Serial.printf("Node %s temp %.2fF battery %umV\n", CRIMINI_NODE_SERIAL, tempF, batteryMv);

  for (uint8_t i = 0; i < CRIMINI_SENSOR_BURST_COUNT; ++i) {
    const bool queued = sendReading(tempF, batteryMv);
    Serial.printf("Burst %u/%u %s\n", i + 1, CRIMINI_SENSOR_BURST_COUNT, queued ? "queued" : "failed");
    delay(CRIMINI_SENSOR_BURST_SPACING_MS + (esp_random() % 70));
  }

  esp_now_deinit();
  sleepUntilNextReading();
}

void loop() {}
