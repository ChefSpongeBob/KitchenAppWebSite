#pragma once

#include <Wire.h>
#include <esp_sleep.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <math.h>

RTC_DATA_ATTR static uint32_t criminiSequence = 0;
static SemaphoreHandle_t criminiTxDone = nullptr;

extern "C" void IRAM_ATTR esp_ieee802154_transmit_done(
    const uint8_t* frame, const uint8_t* ack, esp_ieee802154_frame_info_t* ackInfo) {
  (void)frame;
  (void)ackInfo;
  if (ack) esp_ieee802154_receive_handle_done(ack);
  BaseType_t wake = pdFALSE;
  if (criminiTxDone) xSemaphoreGiveFromISR(criminiTxDone, &wake);
  if (wake) portYIELD_FROM_ISR();
}

extern "C" void IRAM_ATTR esp_ieee802154_transmit_failed(
    const uint8_t* frame, esp_ieee802154_tx_error_t error) {
  (void)frame;
  (void)error;
  BaseType_t wake = pdFALSE;
  if (criminiTxDone) xSemaphoreGiveFromISR(criminiTxDone, &wake);
  if (wake) portYIELD_FROM_ISR();
}

inline void criminiSleepNode() {
  if (CRIMINI_SENSOR_POWER_GPIO >= 0) digitalWrite(CRIMINI_SENSOR_POWER_GPIO, LOW);
  const uint32_t jitter = CRIMINI_SENSOR_JITTER_SECONDS > 0
      ? esp_random() % (CRIMINI_SENSOR_JITTER_SECONDS + 1)
      : 0;
  const uint64_t sleepUs = static_cast<uint64_t>(CRIMINI_SENSOR_WAKE_SECONDS + jitter) * 1000000ULL;
  Serial.printf("Sleep %lu seconds\n", static_cast<unsigned long>(sleepUs / 1000000ULL));
  Serial.flush();
  esp_sleep_enable_timer_wakeup(sleepUs);
  esp_deep_sleep_start();
}

inline bool criminiWriteI2c(uint8_t address, const uint8_t* bytes, size_t count) {
  Wire.beginTransmission(address);
  Wire.write(bytes, count);
  return Wire.endTransmission() == 0;
}

inline bool criminiReadI2c(uint8_t address, uint8_t* bytes, size_t count) {
  if (Wire.requestFrom(static_cast<int>(address), static_cast<int>(count)) != count) return false;
  for (size_t i = 0; i < count; ++i) bytes[i] = static_cast<uint8_t>(Wire.read());
  return true;
}

inline bool criminiReadAht20(float& tempF, float& humidityPct) {
  const uint8_t init[] = {0xBE, 0x08, 0x00};
  const uint8_t measure[] = {0xAC, 0x33, 0x00};
  uint8_t data[6] = {};
  if (!criminiWriteI2c(CRIMINI_AHT20_ADDRESS, init, sizeof(init))) return false;
  delay(20);
  if (!criminiWriteI2c(CRIMINI_AHT20_ADDRESS, measure, sizeof(measure))) return false;
  delay(85);
  if (!criminiReadI2c(CRIMINI_AHT20_ADDRESS, data, sizeof(data)) || (data[0] & 0x80)) return false;
  const uint32_t rawHumidity = (static_cast<uint32_t>(data[1]) << 12) |
                               (static_cast<uint32_t>(data[2]) << 4) | (data[3] >> 4);
  const uint32_t rawTemp = (static_cast<uint32_t>(data[3] & 0x0F) << 16) |
                           (static_cast<uint32_t>(data[4]) << 8) | data[5];
  tempF = (rawTemp / 1048576.0f * 200.0f - 50.0f) * 1.8f + 32.0f;
  humidityPct = rawHumidity / 1048576.0f * 100.0f;
  return isfinite(tempF) && tempF >= -40.0f && tempF <= 185.0f &&
         isfinite(humidityPct) && humidityPct >= 0.0f && humidityPct <= 100.0f;
}

inline bool criminiProbeBmp280() {
  Wire.beginTransmission(CRIMINI_BMP280_ADDRESS);
  Wire.write(0xD0);
  if (Wire.endTransmission(false) != 0) return false;
  uint8_t id = 0;
  return criminiReadI2c(CRIMINI_BMP280_ADDRESS, &id, 1) && id == 0x58;
}

inline uint16_t criminiBatteryMv() {
  if (CRIMINI_BATTERY_ADC_GPIO < 0) return 0;
  analogReadResolution(12);
  const uint32_t millivolts = static_cast<uint32_t>(
      analogReadMilliVolts(CRIMINI_BATTERY_ADC_GPIO) * CRIMINI_BATTERY_DIVIDER_RATIO);
  return static_cast<uint16_t>(min(millivolts, 65535UL));
}

inline void criminiSensorSetup() {
  if (!criminiValidSerial(CRIMINI_NODE_SERIAL) || strlen(CRIMINI_NODE_SECRET) < 32 ||
      CRIMINI_I2C_SDA_GPIO < 0 || CRIMINI_I2C_SCL_GPIO < 0 ||
      CRIMINI_SENSOR_WAKE_SECONDS < 60 || CRIMINI_SENSOR_BURSTS < 1 ||
      CRIMINI_SENSOR_BURSTS > 3) {
    Serial.println("Node configuration incomplete; radio disabled.");
    criminiSleepNode();
  }

  if (CRIMINI_SENSOR_POWER_GPIO >= 0) {
    pinMode(CRIMINI_SENSOR_POWER_GPIO, OUTPUT);
    digitalWrite(CRIMINI_SENSOR_POWER_GPIO, HIGH);
    delay(20);
  }
  Wire.begin(CRIMINI_I2C_SDA_GPIO, CRIMINI_I2C_SCL_GPIO, 100000);
  Serial.printf("BMP280 probe: %s\n", criminiProbeBmp280() ? "present" : "not detected");

  float tempF = 0.0f;
  float humidityPct = 0.0f;
  if (!criminiReadAht20(tempF, humidityPct)) {
    Serial.println("AHT20 read failed; no packet sent.");
    criminiSleepNode();
  }

  CriminiTempPacket packet = {};
  packet.magic = CRIMINI_PACKET_MAGIC;
  packet.version = CRIMINI_PACKET_VERSION;
  packet.packetType = CRIMINI_PACKET_TYPE_TEMP;
  packet.sequence = ++criminiSequence;
  packet.wakeNonce = esp_random();
  strncpy(packet.nodeSerial, CRIMINI_NODE_SERIAL, CRIMINI_SERIAL_SIZE - 1);
  packet.tempCentiF = static_cast<int32_t>(lroundf(tempF * 100.0f));
  packet.humidityCentiPct = static_cast<uint16_t>(lroundf(humidityPct * 100.0f));
  packet.batteryMv = criminiBatteryMv();
  if (!criminiSignPacket(packet, CRIMINI_NODE_SECRET)) criminiSleepNode();

  criminiTxDone = xSemaphoreCreateBinary();
  if (!criminiTxDone || !criminiRadioBegin(false, CRIMINI_NODE_SHORT_ADDR)) {
    Serial.println("Radio initialization failed.");
    criminiSleepNode();
  }

  for (uint8_t burst = 0; burst < CRIMINI_SENSOR_BURSTS; ++burst) {
    uint8_t frame[128] = {};
    if (!criminiBuildFrame(frame, sizeof(frame), static_cast<uint8_t>(packet.sequence + burst), packet)) break;
    xSemaphoreTake(criminiTxDone, 0);
    const esp_err_t started = esp_ieee802154_transmit(frame, true);
    if (started == ESP_OK) {
      if (xSemaphoreTake(criminiTxDone, pdMS_TO_TICKS(500)) != pdTRUE) {
        Serial.println("Radio TX timeout.");
      }
    }
    delay(CRIMINI_SENSOR_BURST_SPACING_MS);
  }
  esp_ieee802154_sleep();
  Wire.end();
  Serial.printf("Sent %s seq=%lu temp=%.2fF humidity=%.1f%%\n", packet.nodeSerial,
                static_cast<unsigned long>(packet.sequence), tempF, humidityPct);
  criminiSleepNode();
}
