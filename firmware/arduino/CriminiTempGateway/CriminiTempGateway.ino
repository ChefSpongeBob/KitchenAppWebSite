#include <Arduino.h>
#include <WiFi.h>
#include <esp_crt_bundle.h>
#include <esp_http_client.h>
#include <esp_ieee802154.h>
#include <freertos/queue.h>
#include <mbedtls/md.h>
#include <time.h>

#ifndef ARDUINO_XIAO_ESP32C6
#error "Select XIAO_ESP32C6 in Arduino IDE for this gateway."
#endif

// Set these before uploading the gateway.
const char GATEWAY_SERIAL[] = "";
const char FACTORY_GATEWAY_CREDENTIAL[] = "";
const char RADIO_SECRET[] = "";
const char WIFI_NAME[] = "";
const char WIFI_PASSWORD[] = "";
const char API_URL[] = "https://criminiops.com/api/temps";

constexpr uint8_t RADIO_CHANNEL = 20;
constexpr uint16_t RADIO_PAN = 0xC110;
constexpr uint16_t GATEWAY_ADDRESS = 0x0001;
constexpr size_t MAX_PENDING_NODES = 16;
constexpr size_t AUTH_TAG_SIZE = 16;
constexpr size_t RECENT_PACKET_COUNT = 128;
constexpr uint32_t UPLOAD_INTERVAL_MS = 10000;
constexpr uint32_t RETRY_INTERVAL_MS = 60000;
constexpr uint32_t HEARTBEAT_INTERVAL_MS = 300000;
constexpr uint32_t RADIO_SILENCE_RECOVERY_MS = 720000;

struct RadioFrame {
  uint8_t bytes[128];
  uint8_t length;
  int8_t rssi;
  uint8_t lqi;
};

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

struct RecentPacket {
  char serial[32];
  uint32_t sequence;
  uint32_t wakeNonce;
};

struct QueuedReading {
  TemperaturePacket packet;
  int8_t rssi;
  uint8_t lqi;
  uint32_t receivedAt;
};

QueuedReading readings[MAX_PENDING_NODES] = {};
size_t readingCount = 0;
uint32_t lastUpload = 0;
uint32_t uploadInterval = UPLOAD_INTERVAL_MS;
uint32_t lastCloudAttempt = 0;
uint32_t heartbeatInterval = HEARTBEAT_INTERVAL_MS;
uint32_t lastAuthenticatedPacket = 0;
uint32_t lastRadioRecovery = 0;
uint8_t consecutiveRadioRecoveries = 0;
QueueHandle_t receivedFrames = nullptr;
RecentPacket recentPackets[RECENT_PACKET_COUNT] = {};
size_t recentPacketCount = 0;
size_t nextRecentPacket = 0;
uint32_t lastRadioDiagnostic = 0;

void reportRadioIssue(const char* message) {
  const uint32_t now = millis();
  if (now - lastRadioDiagnostic < 1000) return;
  lastRadioDiagnostic = now;
  Serial.printf("Radio: %s\n", message);
}

void configureRadio() {
  esp_ieee802154_set_channel(RADIO_CHANNEL);
  esp_ieee802154_set_panid(RADIO_PAN);
  esp_ieee802154_set_short_address(GATEWAY_ADDRESS);
  esp_ieee802154_set_coordinator(true);
  esp_ieee802154_set_rx_when_idle(true);
}

bool resumeRadioReceiver() {
  esp_ieee802154_state_t state = esp_ieee802154_get_state();
  if (state == ESP_IEEE802154_RADIO_DISABLE) {
    if (esp_ieee802154_enable() != ESP_OK) return false;
    configureRadio();
    state = esp_ieee802154_get_state();
  }
  if (state == ESP_IEEE802154_RADIO_RECEIVE) return true;
  if (state == ESP_IEEE802154_RADIO_TRANSMIT) {
    const uint32_t started = millis();
    while (esp_ieee802154_get_state() == ESP_IEEE802154_RADIO_TRANSMIT && millis() - started < 100) {
      delay(2);
    }
  }
  return esp_ieee802154_receive() == ESP_OK;
}

bool resetRadioReceiver() {
  esp_ieee802154_state_t state = esp_ieee802154_get_state();
  if (state != ESP_IEEE802154_RADIO_DISABLE) {
    if (state != ESP_IEEE802154_RADIO_SLEEP) {
      const uint32_t started = millis();
      while (esp_ieee802154_sleep() != ESP_OK && millis() - started < 100) delay(2);
    }
    if (esp_ieee802154_disable() != ESP_OK) return false;
  }
  delay(20);
  return resumeRadioReceiver();
}

bool pauseRadioForWifi() {
  const uint32_t started = millis();
  while (millis() - started < 100) {
    const esp_ieee802154_state_t state = esp_ieee802154_get_state();
    if (state == ESP_IEEE802154_RADIO_DISABLE || state == ESP_IEEE802154_RADIO_SLEEP) return true;
    if (state != ESP_IEEE802154_RADIO_TRANSMIT && esp_ieee802154_sleep() == ESP_OK) return true;
    delay(2);
  }
  return false;
}

bool validSerial(const char* serial) {
  const size_t length = strnlen(serial, 32);
  if (!length || length >= 32) return false;
  for (size_t i = 0; i < length; ++i) {
    const char c = serial[i];
    if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_')) return false;
  }
  return true;
}

bool verifyPacket(const TemperaturePacket& packet) {
  const mbedtls_md_info_t* sha256 = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  uint8_t digest[32] = {};
  if (!sha256 || mbedtls_md_hmac(sha256,
      reinterpret_cast<const uint8_t*>(RADIO_SECRET), strlen(RADIO_SECRET),
      reinterpret_cast<const uint8_t*>(&packet), offsetof(TemperaturePacket, authTag), digest) != 0) return false;
  uint8_t difference = 0;
  for (size_t i = 0; i < AUTH_TAG_SIZE; ++i) difference |= digest[i] ^ packet.authTag[i];
  memset(digest, 0, sizeof(digest));
  return difference == 0;
}

bool seenRecently(const TemperaturePacket& packet) {
  for (size_t i = 0; i < recentPacketCount; ++i) {
    if (recentPackets[i].sequence == packet.sequence &&
        recentPackets[i].wakeNonce == packet.wakeNonce &&
        strcmp(recentPackets[i].serial, packet.serial) == 0) return true;
  }
  RecentPacket& recent = recentPackets[nextRecentPacket];
  memcpy(recent.serial, packet.serial, sizeof(recent.serial));
  recent.sequence = packet.sequence;
  recent.wakeNonce = packet.wakeNonce;
  nextRecentPacket = (nextRecentPacket + 1) % RECENT_PACKET_COUNT;
  if (recentPacketCount < RECENT_PACKET_COUNT) ++recentPacketCount;
  return false;
}

void retainLatestReading(const TemperaturePacket& packet, int8_t rssi, uint8_t lqi) {
  const QueuedReading reading = { packet, rssi, lqi, uint32_t(time(nullptr)) };
  for (size_t i = 0; i < readingCount; ++i) {
    if (strcmp(readings[i].packet.serial, packet.serial) == 0) {
      readings[i] = reading;
      return;
    }
  }

  if (readingCount < MAX_PENDING_NODES) {
    readings[readingCount++] = reading;
    return;
  }

  size_t oldest = 0;
  for (size_t i = 1; i < readingCount; ++i) {
    if (readings[i].receivedAt < readings[oldest].receivedAt) oldest = i;
  }
  readings[oldest] = reading;
}

extern "C" void IRAM_ATTR esp_ieee802154_receive_done(uint8_t* frame, esp_ieee802154_frame_info_t* info) {
  if (frame && frame[0] <= 127 && receivedFrames) {
    RadioFrame incoming = {};
    incoming.length = frame[0] + 1;
    memcpy(incoming.bytes, frame, incoming.length);
    incoming.rssi = info ? info->rssi : 0;
    incoming.lqi = info ? info->lqi : 0;
    BaseType_t wake = pdFALSE;
    xQueueSendFromISR(receivedFrames, &incoming, &wake);
    if (wake) portYIELD_FROM_ISR();
  }
  if (frame) esp_ieee802154_receive_handle_done(frame);
}

void receiveReading(const RadioFrame& incoming) {
  const size_t headerSize = 9;
  const size_t expectedLength = headerSize + sizeof(TemperaturePacket) + 2;
  if (incoming.length != expectedLength + 1) {
    reportRadioIssue("ignored unexpected frame length");
    return;
  }
  if ((incoming.bytes[1] != 0x41 && incoming.bytes[1] != 0x61) || incoming.bytes[2] != 0x88) {
    reportRadioIssue("ignored unsupported frame type");
    return;
  }
  if (incoming.bytes[4] != (RADIO_PAN & 0xFF) || incoming.bytes[5] != (RADIO_PAN >> 8) ||
      incoming.bytes[6] != (GATEWAY_ADDRESS & 0xFF) || incoming.bytes[7] != (GATEWAY_ADDRESS >> 8)) {
    reportRadioIssue("ignored wrong PAN or destination");
    return;
  }

  TemperaturePacket packet = {};
  memcpy(&packet, incoming.bytes + 1 + headerSize, sizeof(packet));
  if (packet.marker != 0x4352 || packet.version != 2 || packet.humidityHundredths > 10000 ||
      !validSerial(packet.serial)) {
    reportRadioIssue("ignored invalid payload");
    return;
  }
  if (!verifyPacket(packet)) {
    reportRadioIssue("ignored authentication mismatch");
    return;
  }
  lastAuthenticatedPacket = millis();
  consecutiveRadioRecoveries = 0;
  if (seenRecently(packet)) return;

  retainLatestReading(packet, incoming.rssi, incoming.lqi);
  Serial.printf("Received %s: %.2f F\n", packet.serial, packet.temperatureHundredthsF / 100.0f);
}

bool connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 7000) delay(100);
  if (WiFi.status() != WL_CONNECTED) return false;
  if (time(nullptr) < 1700000000) {
    configTime(0, 0, "time.cloudflare.com", "pool.ntp.org");
    const uint32_t clockStarted = millis();
    while (time(nullptr) < 1700000000 && millis() - clockStarted < 10000) delay(100);
  }
  return time(nullptr) >= 1700000000;
}

String requestBody() {
  String body = "{\"readings\":[";
  body.reserve(readingCount * 220 + 20);
  for (size_t i = 0; i < readingCount; ++i) {
    if (i) body += ',';
    const QueuedReading& reading = readings[i];
    char nonce[9];
    snprintf(nonce, sizeof(nonce), "%08lx", static_cast<unsigned long>(reading.packet.wakeNonce));
    body += "{\"node_serial\":\"" + String(reading.packet.serial) + "\"";
    body += ",\"temperature\":" + String(reading.packet.temperatureHundredthsF / 100.0f, 2);
    body += ",\"humidity_pct\":" + String(reading.packet.humidityHundredths / 100.0f, 2);
    body += ",\"packet_sequence\":" + String(reading.packet.sequence);
    body += ",\"wake_nonce\":\"" + String(nonce) + "\"";
    body += ",\"rssi\":" + String(reading.rssi);
    body += ",\"lqi\":" + String(reading.lqi);
    if (reading.receivedAt >= 1700000000) body += ",\"ts\":" + String(reading.receivedAt);
    body += '}';
  }
  body += "]}";
  return body;
}

esp_err_t onHttpEvent(esp_http_client_event_t* event) {
  if (event->event_id == HTTP_EVENT_ON_DATA && event->user_data && event->data_len > 0) {
    String& response = *static_cast<String*>(event->user_data);
    if (response.length() + event->data_len <= 256) {
      response.concat(static_cast<const char*>(event->data), event->data_len);
    }
  }
  return ESP_OK;
}

bool uploadReadings(bool heartbeat = false) {
  const size_t submittedCount = readingCount;
  if (!submittedCount && !heartbeat) return true;
  if (!pauseRadioForWifi()) reportRadioIssue("receiver did not pause for upload");

  bool uploaded = false;
  if (connectWifi()) {
    String response;
    esp_http_client_config_t config = {};
    config.url = API_URL;
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.event_handler = onHttpEvent;
    config.user_data = &response;
    config.timeout_ms = 12000;
    esp_http_client_handle_t request = esp_http_client_init(&config);
    if (request) {
      const String body = requestBody();
      esp_http_client_set_method(request, HTTP_METHOD_POST);
      esp_http_client_set_header(request, "Content-Type", "application/json");
      esp_http_client_set_header(request, "x-device-id", GATEWAY_SERIAL);
      esp_http_client_set_header(request, "x-device-key", FACTORY_GATEWAY_CREDENTIAL);
      esp_http_client_set_post_field(request, body.c_str(), body.length());
      const esp_err_t result = esp_http_client_perform(request);
      const int status = esp_http_client_get_status_code(request);
      if (result != ESP_OK) {
        const int socketError = esp_http_client_get_errno(request);
        int tlsError = 0;
        int tlsFlags = 0;
        esp_http_client_get_and_clear_last_tls_error(request, &tlsError, &tlsFlags);
        Serial.printf("HTTPS failure: %s, socket %d, TLS 0x%x, flags 0x%x\n",
                      esp_err_to_name(result), socketError, tlsError, tlsFlags);
      }
      const int acceptedField = response.indexOf("\"accepted\":");
      const int rejectedField = response.indexOf("\"rejected\":");
      const int accepted = acceptedField >= 0 ? response.substring(acceptedField + 11).toInt() : -1;
      const int rejected = rejectedField >= 0 ? response.substring(rejectedField + 11).toInt() : -1;
      uploaded = (status == 200 || status == 201) && accepted >= 0 && rejected >= 0 &&
                  accepted + rejected == static_cast<int>(submittedCount);
      Serial.printf("Crimini upload: HTTP %d, accepted %d, rejected %d/%u\n", status, accepted, rejected,
                    static_cast<unsigned>(submittedCount));
      esp_http_client_cleanup(request);
    }
  }
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_OFF);
  if (uploaded && submittedCount) readingCount = 0;
  delay(20);
  if (!resumeRadioReceiver() && !resetRadioReceiver()) {
    Serial.println("Radio: recovery failed; restarting gateway");
    delay(100);
    ESP.restart();
  }
  return uploaded;
}

void setup() {
  Serial.begin(115200);
  delay(100);
  if (!validSerial(GATEWAY_SERIAL) || strlen(FACTORY_GATEWAY_CREDENTIAL) < 32 ||
      strlen(RADIO_SECRET) < 16 ||
      !WIFI_NAME[0] || !WIFI_PASSWORD[0]) {
    Serial.println("Complete gateway factory setup before uploading.");
    return;
  }
  // XIAO ESP32C6 defaults to its ceramic antenna; route both radios to the external connector.
  pinMode(WIFI_ENABLE, OUTPUT);
  digitalWrite(WIFI_ENABLE, LOW);
  delay(100);
  pinMode(WIFI_ANT_CONFIG, OUTPUT);
  digitalWrite(WIFI_ANT_CONFIG, HIGH);

  receivedFrames = xQueueCreate(16, sizeof(RadioFrame));
  if (!receivedFrames) return;
  if (!resumeRadioReceiver()) {
    Serial.println("Radio: receiver failed to start");
    return;
  }
  const uint32_t now = millis();
  lastUpload = now;
  lastCloudAttempt = now;
  lastAuthenticatedPacket = now;
  lastRadioRecovery = now;
  Serial.printf("Gateway %s listening on channel %u\n", GATEWAY_SERIAL, RADIO_CHANNEL);
}

void loop() {
  RadioFrame incoming = {};
  if (receivedFrames && xQueueReceive(receivedFrames, &incoming, pdMS_TO_TICKS(20)) == pdTRUE) {
    receiveReading(incoming);
    if (!resumeRadioReceiver()) reportRadioIssue("receiver did not continue after frame");
  }
  const uint32_t now = millis();
  if (readingCount && now - lastUpload >= uploadInterval) {
    uploadInterval = uploadReadings() ? UPLOAD_INTERVAL_MS : RETRY_INTERVAL_MS;
    lastUpload = millis();
    lastCloudAttempt = lastUpload;
    heartbeatInterval = HEARTBEAT_INTERVAL_MS;
  } else if (!readingCount && now - lastCloudAttempt >= heartbeatInterval) {
    heartbeatInterval = uploadReadings(true) ? HEARTBEAT_INTERVAL_MS : RETRY_INTERVAL_MS;
    lastCloudAttempt = millis();
  }
  if (now - lastAuthenticatedPacket >= RADIO_SILENCE_RECOVERY_MS &&
      now - lastRadioRecovery >= RADIO_SILENCE_RECOVERY_MS) {
    Serial.println("Radio: no authenticated node packets; rebuilding receiver");
    lastRadioRecovery = now;
    ++consecutiveRadioRecoveries;
    if (!resetRadioReceiver() || consecutiveRadioRecoveries >= 2) {
      Serial.println("Radio: prolonged silence; restarting gateway");
      delay(100);
      ESP.restart();
    }
  }
  delay(20);
}
