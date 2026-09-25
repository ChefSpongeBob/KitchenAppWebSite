#include <Arduino.h>
#include <Wire.h>
#include <Preferences.h>
#include <esp_ieee802154.h>
#include <esp_sleep.h>
#include <mbedtls/md.h>

// Set this serial before uploading each sensor.
const char NODE_SERIAL[] = "";
// Factory-set per gateway kit. Put the same value in its gateway sketch; never use the cloud credential here.
const char RADIO_SECRET[] = "";

constexpr int SDA_PIN = 18;
constexpr int SCL_PIN = 19;
constexpr uint8_t AHT20_ADDRESS = 0x38;
constexpr uint8_t RADIO_CHANNEL = 20;
constexpr uint16_t RADIO_PAN = 0xC110;
constexpr uint16_t GATEWAY_ADDRESS = 0x0001;
constexpr uint32_t SLEEP_SECONDS = 300;
constexpr uint8_t SEND_COUNT = 3;
constexpr size_t AUTH_TAG_SIZE = 16;

struct __attribute__((packed)) TemperaturePacket {
  uint16_t marker;
  uint8_t version;
  uint32_t sequence;
  uint32_t wakeNonce;
  char serial[32];
  int32_t temperatureHundredthsF;
  uint16_t humidityHundredths;
  uint8_t authTag[AUTH_TAG_SIZE];
};

static_assert(sizeof(TemperaturePacket) + 11 <= 127, "Radio packet exceeds IEEE 802.15.4 frame size");

RTC_DATA_ATTR uint32_t sequenceNumber = 0;
RTC_DATA_ATTR uint32_t reservedThrough = 0;
volatile bool transmitFinished = false;

extern "C" void IRAM_ATTR esp_ieee802154_transmit_done(
    const uint8_t*, const uint8_t* ack, esp_ieee802154_frame_info_t*) {
  if (ack) esp_ieee802154_receive_handle_done(ack);
  transmitFinished = true;
}

extern "C" void IRAM_ATTR esp_ieee802154_transmit_failed(
    const uint8_t*, esp_ieee802154_tx_error_t) {
  transmitFinished = true;
}

bool writeSensor(const uint8_t* bytes, size_t count) {
  Wire.beginTransmission(AHT20_ADDRESS);
  Wire.write(bytes, count);
  return Wire.endTransmission() == 0;
}

bool readAht20(float& temperatureF, float& humidity) {
  const uint8_t initialize[] = {0xBE, 0x08, 0x00};
  const uint8_t measure[] = {0xAC, 0x33, 0x00};
  uint8_t data[6] = {};

  if (!writeSensor(initialize, sizeof(initialize))) return false;
  delay(20);
  if (!writeSensor(measure, sizeof(measure))) return false;
  delay(85);
  if (Wire.requestFrom(AHT20_ADDRESS, static_cast<uint8_t>(6)) != 6) return false;
  for (uint8_t& byte : data) byte = Wire.read();
  if (data[0] & 0x80) return false;

  const uint32_t rawHumidity = (uint32_t(data[1]) << 12) | (uint32_t(data[2]) << 4) | (data[3] >> 4);
  const uint32_t rawTemperature = (uint32_t(data[3] & 0x0F) << 16) | (uint32_t(data[4]) << 8) | data[5];
  humidity = rawHumidity * 100.0f / 1048576.0f;
  const float temperatureC = rawTemperature * 200.0f / 1048576.0f - 50.0f;
  temperatureF = temperatureC * 1.8f + 32.0f;
  return isfinite(temperatureF) && isfinite(humidity) && humidity >= 0.0f && humidity <= 100.0f;
}

bool validSerial() {
  const size_t length = strnlen(NODE_SERIAL, 32);
  if (!length || length >= 32) return false;
  for (size_t i = 0; i < length; ++i) {
    const char c = NODE_SERIAL[i];
    if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_')) return false;
  }
  return true;
}

uint16_t radioAddressFromSerial() {
  uint32_t hash = 2166136261UL;
  for (size_t i = 0; NODE_SERIAL[i] != '\0'; ++i) {
    hash ^= static_cast<uint8_t>(NODE_SERIAL[i]);
    hash *= 16777619UL;
  }
  // 0x0000, the gateway's 0x0001, and 0xffff are reserved here.
  return static_cast<uint16_t>(2 + (hash % 65532UL));
}

bool signPacket(TemperaturePacket& packet) {
  const mbedtls_md_info_t* sha256 = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  uint8_t digest[32] = {};
  if (!sha256 || mbedtls_md_hmac(sha256,
      reinterpret_cast<const uint8_t*>(RADIO_SECRET), strlen(RADIO_SECRET),
      reinterpret_cast<const uint8_t*>(&packet), offsetof(TemperaturePacket, authTag), digest) != 0) return false;
  memcpy(packet.authTag, digest, AUTH_TAG_SIZE);
  memset(digest, 0, sizeof(digest));
  return true;
}

bool advanceSequence() {
  if (esp_sleep_get_wakeup_cause() != ESP_SLEEP_WAKEUP_TIMER) {
    sequenceNumber = 0;
    reservedThrough = 0;
  }
  if (sequenceNumber < reservedThrough) {
    ++sequenceNumber;
    return true;
  }

  // Reserve 256 readings in flash; normal deep-sleep wakes use only RTC memory.
  Preferences storage;
  if (!storage.begin("crimini", false)) return false;
  const uint32_t next = storage.getUInt("next_seq", 1);
  const bool valid = next > 0 && next <= UINT32_MAX - 256;
  const bool saved = valid && storage.putUInt("next_seq", next + 256) == sizeof(uint32_t);
  storage.end();
  if (!saved) return false;
  sequenceNumber = next;
  reservedThrough = next + 255;
  return true;
}

void sleepNow() {
  Wire.end();
  esp_sleep_enable_timer_wakeup(uint64_t(SLEEP_SECONDS + esp_random() % 21) * 1000000ULL);
  Serial.flush();
  esp_deep_sleep_start();
}

void setup() {
  Serial.begin(115200);
  delay(100);
  if (!validSerial() || strlen(RADIO_SECRET) < 16) {
    Serial.println("Set NODE_SERIAL and the factory RADIO_SECRET before uploading.");
    sleepNow();
  }

  Wire.begin(SDA_PIN, SCL_PIN, 100000);
  float temperatureF = 0.0f;
  float humidity = 0.0f;
  if (!readAht20(temperatureF, humidity)) {
    Serial.println("AHT20 read failed.");
    sleepNow();
  }
  if (!advanceSequence()) {
    Serial.println("Could not reserve packet sequence; reading not sent.");
    sleepNow();
  }

  TemperaturePacket packet = {};
  packet.marker = 0x4352;
  packet.version = 2;
  packet.sequence = sequenceNumber;
  packet.wakeNonce = esp_random();
  strncpy(packet.serial, NODE_SERIAL, sizeof(packet.serial) - 1);
  packet.temperatureHundredthsF = lroundf(temperatureF * 100.0f);
  packet.humidityHundredths = lroundf(humidity * 100.0f);
  if (!signPacket(packet)) {
    Serial.println("Radio packet signing failed.");
    sleepNow();
  }

  esp_ieee802154_enable();
  esp_ieee802154_set_channel(RADIO_CHANNEL);
  esp_ieee802154_set_txpower(0);
  esp_ieee802154_set_panid(RADIO_PAN);
  esp_ieee802154_set_short_address(radioAddressFromSerial());
  esp_ieee802154_set_rx_when_idle(false);

  for (uint8_t attempt = 0; attempt < SEND_COUNT; ++attempt) {
    uint8_t frame[128] = {};
    const uint16_t frameControl = 0x8841;
    const size_t headerSize = 9;
    const size_t phyLength = headerSize + sizeof(packet) + 2;
    frame[0] = phyLength;
    frame[1] = frameControl & 0xFF;
    frame[2] = frameControl >> 8;
    frame[3] = uint8_t(packet.sequence + attempt);
    frame[4] = RADIO_PAN & 0xFF;
    frame[5] = RADIO_PAN >> 8;
    frame[6] = GATEWAY_ADDRESS & 0xFF;
    frame[7] = GATEWAY_ADDRESS >> 8;
    const uint16_t nodeAddress = radioAddressFromSerial();
    frame[8] = nodeAddress & 0xFF;
    frame[9] = nodeAddress >> 8;
    memcpy(frame + 1 + headerSize, &packet, sizeof(packet));

    transmitFinished = false;
    if (esp_ieee802154_transmit(frame, true) == ESP_OK) {
      const uint32_t started = millis();
      while (!transmitFinished && millis() - started < 500) delay(1);
    }
    delay(180);
  }

  esp_ieee802154_sleep();
  Serial.printf("Sent %s: %.2f F, %.1f%% humidity\n", NODE_SERIAL, temperatureF, humidity);
  sleepNow();
}

void loop() {}
