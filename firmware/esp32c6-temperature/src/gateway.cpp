#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <time.h>

#if __has_include("crimini_iot_config.h")
#include "crimini_iot_config.h"
#else
#error "Copy include/crimini_iot_config.example.h to include/crimini_iot_config.h and fill gateway values."
#endif

#include "crimini_iot_protocol.h"

struct QueuedReading {
  char nodeSerial[CRIMINI_SERIAL_SIZE];
  float temperatureF;
  uint16_t batteryMv;
  int8_t rssi;
  uint32_t receivedAt;
};

static QueuedReading readingQueue[CRIMINI_GATEWAY_BATCH_MAX];
static size_t readingCount = 0;
static uint32_t lastFlushMs = 0;
static int gatewayWifiChannel = CRIMINI_ESPNOW_CHANNEL;

static void configureRadioLimits() {
  wifi_country_t country = {"US", 1, 11, WIFI_COUNTRY_POLICY_MANUAL};
  esp_wifi_set_country(&country);
  esp_wifi_set_max_tx_power(CRIMINI_TX_POWER_QDBM);
}

static void printGatewayMac() {
  uint8_t mac[6] = {0};
  esp_wifi_get_mac(WIFI_IF_STA, mac);
  Serial.printf("Gateway MAC: %02X:%02X:%02X:%02X:%02X:%02X\n", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static bool connectWifi() {
  WiFi.mode(WIFI_STA);
  configureRadioLimits();
  WiFi.begin(CRIMINI_WIFI_SSID, CRIMINI_WIFI_PASSWORD);

  Serial.print("Connecting Wi-Fi");
  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 30000) {
    delay(300);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) return false;

  gatewayWifiChannel = WiFi.channel();
  Serial.printf("Wi-Fi connected on channel %d, IP %s\n", gatewayWifiChannel, WiFi.localIP().toString().c_str());
  if (gatewayWifiChannel != CRIMINI_ESPNOW_CHANNEL) {
    Serial.printf("WARNING: sensor config channel %d must match gateway Wi-Fi channel %d\n", CRIMINI_ESPNOW_CHANNEL, gatewayWifiChannel);
  }
  printGatewayMac();
  return true;
}

static void syncClock() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Syncing clock");
  const uint32_t started = millis();
  while (time(nullptr) < 1700000000 && millis() - started < 20000) {
    delay(300);
    Serial.print('.');
  }
  Serial.println();
  Serial.printf("Epoch: %ld\n", static_cast<long>(time(nullptr)));
}

static const char* findNodeSecret(const char* serial) {
  for (size_t i = 0; i < sizeof(CRIMINI_KNOWN_NODES) / sizeof(CRIMINI_KNOWN_NODES[0]); ++i) {
    if (strcmp(serial, CRIMINI_KNOWN_NODES[i].serial) == 0) return CRIMINI_KNOWN_NODES[i].secret;
  }
  return nullptr;
}

static void queueReading(const CriminiTempPacket& packet, int8_t rssi) {
  if (readingCount >= CRIMINI_GATEWAY_BATCH_MAX) return;
  QueuedReading& row = readingQueue[readingCount++];
  criminiCopySerial(row.nodeSerial, packet.nodeSerial);
  row.temperatureF = static_cast<float>(packet.tempCentiF) / 100.0f;
  row.batteryMv = packet.batteryMv;
  row.rssi = rssi;
  row.receivedAt = static_cast<uint32_t>(time(nullptr));
}

static void onEspNowReceive(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  if (!data || len != static_cast<int>(sizeof(CriminiTempPacket))) return;

  CriminiTempPacket packet = {};
  memcpy(&packet, data, sizeof(packet));

  if (packet.magic != CRIMINI_PACKET_MAGIC || packet.version != CRIMINI_PACKET_VERSION || packet.packetType != CRIMINI_PACKET_TYPE_TEMP) return;
  packet.nodeSerial[CRIMINI_SERIAL_SIZE - 1] = '\0';

  const char* secret = findNodeSecret(packet.nodeSerial);
  if (!secret || !criminiVerifyPacket(packet, secret)) {
    Serial.printf("Rejected packet from unknown/invalid node %s\n", packet.nodeSerial);
    return;
  }

  const int8_t rssi = info && info->rx_ctrl ? static_cast<int8_t>(info->rx_ctrl->rssi) : 0;
  queueReading(packet, rssi);
  Serial.printf("Queued %s %.2fF rssi %d (%u queued)\n", packet.nodeSerial, packet.tempCentiF / 100.0f, rssi, static_cast<unsigned>(readingCount));
}

static bool initEspNow() {
  if (esp_now_init() != ESP_OK) return false;
  return esp_now_register_recv_cb(onEspNowReceive) == ESP_OK;
}

static String jsonEscape(const char* input) {
  String out;
  while (*input) {
    const char c = *input++;
    if (c == '"' || c == '\\') out += '\\';
    out += c;
  }
  return out;
}

static String buildJsonPayload() {
  String body = "{\"readings\":[";
  for (size_t i = 0; i < readingCount; ++i) {
    if (i) body += ',';
    body += "{\"node_serial\":\"";
    body += jsonEscape(readingQueue[i].nodeSerial);
    body += "\",\"temperature\":";
    body += String(readingQueue[i].temperatureF, 2);
    body += ",\"ts\":";
    body += String(readingQueue[i].receivedAt);
    body += ",\"battery_mv\":";
    body += String(readingQueue[i].batteryMv);
    body += ",\"rssi\":";
    body += String(readingQueue[i].rssi);
    body += '}';
  }
  body += "]}";
  return body;
}

static bool postReadings() {
  if (readingCount == 0) return true;
  if (WiFi.status() != WL_CONNECTED && !connectWifi()) return false;

  const size_t tlsLength = strlen(CRIMINI_TLS_ROOT_CA_PEM);
#ifndef CRIMINI_ALLOW_INSECURE_TLS_FOR_LAB
  if (tlsLength == 0) {
    Serial.println("TLS root CA missing; refusing HTTPS post.");
    return false;
  }
#endif

  WiFiClientSecure client;
#ifdef CRIMINI_ALLOW_INSECURE_TLS_FOR_LAB
  if (tlsLength == 0) client.setInsecure(); else client.setCACert(CRIMINI_TLS_ROOT_CA_PEM);
#else
  client.setCACert(CRIMINI_TLS_ROOT_CA_PEM);
#endif

  HTTPClient http;
  const String url = String(CRIMINI_API_BASE_URL) + "/api/temps";
  if (!http.begin(client, url)) return false;

  http.addHeader("content-type", "application/json");
  http.addHeader("x-device-id", CRIMINI_GATEWAY_SERIAL);
  http.addHeader("x-device-key", CRIMINI_GATEWAY_DEVICE_KEY);
  if (strlen(CRIMINI_OPTIONAL_BUSINESS_ID) > 0) http.addHeader("x-business-id", CRIMINI_OPTIONAL_BUSINESS_ID);

  const String body = buildJsonPayload();
  const int code = http.POST(body);
  const String response = http.getString();
  http.end();

  Serial.printf("POST /api/temps -> %d %s\n", code, response.c_str());
  if (code >= 200 && code < 300) {
    readingCount = 0;
    return true;
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(300);

  if (!connectWifi()) Serial.println("Wi-Fi not connected; gateway will keep retrying posts.");
  syncClock();

  if (!initEspNow()) {
    Serial.println("ESP-NOW init failed; rebooting soon.");
    delay(5000);
    ESP.restart();
  }

  lastFlushMs = millis();
  Serial.println("Crimini temperature gateway ready.");
}

void loop() {
  if (readingCount >= CRIMINI_GATEWAY_BATCH_MAX || millis() - lastFlushMs >= CRIMINI_GATEWAY_FLUSH_MS) {
    postReadings();
    lastFlushMs = millis();
  }

  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  delay(100);
}
