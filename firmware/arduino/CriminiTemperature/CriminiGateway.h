#pragma once

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <time.h>

static constexpr size_t CRIMINI_GATEWAY_QUEUE_SIZE = 24;
static constexpr uint32_t CRIMINI_GATEWAY_POST_INTERVAL_MS = 10000;

struct CriminiRadioEvent {
  uint8_t frame[128];
  uint8_t length;
  int8_t rssi;
  uint8_t lqi;
};

struct CriminiQueuedReading {
  CriminiTempPacket packet;
  int8_t rssi;
  uint8_t lqi;
  time_t receivedAt;
};

struct CriminiSeenPacket {
  char serial[CRIMINI_SERIAL_SIZE];
  uint32_t sequence;
  uint32_t wakeNonce;
};

static QueueHandle_t criminiRadioEvents = nullptr;
static CriminiQueuedReading criminiPending[CRIMINI_GATEWAY_QUEUE_SIZE] = {};
static size_t criminiPendingCount = 0;
static CriminiSeenPacket criminiSeen[64] = {};
static size_t criminiSeenCursor = 0;
static uint32_t criminiLastPostMs = 0;

extern "C" void IRAM_ATTR esp_ieee802154_receive_done(
    uint8_t* frame, esp_ieee802154_frame_info_t* info) {
  if (frame && frame[0] <= 127 && criminiRadioEvents) {
    CriminiRadioEvent event = {};
    event.length = static_cast<uint8_t>(1 + frame[0]);
    memcpy(event.frame, frame, event.length);
    event.rssi = info ? info->rssi : 0;
    event.lqi = info ? info->lqi : 0;
    BaseType_t wake = pdFALSE;
    xQueueSendFromISR(criminiRadioEvents, &event, &wake);
    if (wake) portYIELD_FROM_ISR();
  }
  if (frame) esp_ieee802154_receive_handle_done(frame);
}

inline const char* criminiFindNodeSecret(const char* serial) {
  for (const CriminiKnownNode& node : CRIMINI_KNOWN_NODES) {
    if (criminiValidSerial(node.serial) && strcmp(node.serial, serial) == 0 &&
        node.secret && strlen(node.secret) >= 32) return node.secret;
  }
  return nullptr;
}

inline bool criminiHasKnownNode() {
  for (const CriminiKnownNode& node : CRIMINI_KNOWN_NODES) {
    if (criminiValidSerial(node.serial) && node.secret && strlen(node.secret) >= 32) return true;
  }
  return false;
}

inline bool criminiAlreadySeen(const CriminiTempPacket& packet) {
  for (const CriminiSeenPacket& seen : criminiSeen) {
    if (seen.sequence == packet.sequence && seen.wakeNonce == packet.wakeNonce &&
        strcmp(seen.serial, packet.nodeSerial) == 0) return true;
  }
  return false;
}

inline void criminiRememberPacket(const CriminiTempPacket& packet) {
  CriminiSeenPacket& seen = criminiSeen[criminiSeenCursor++ % 64];
  memset(&seen, 0, sizeof(seen));
  strncpy(seen.serial, packet.nodeSerial, CRIMINI_SERIAL_SIZE - 1);
  seen.sequence = packet.sequence;
  seen.wakeNonce = packet.wakeNonce;
}

inline void criminiHandleRadioEvent(const CriminiRadioEvent& event) {
  CriminiTempPacket packet = {};
  if (!criminiParseFrame(event.frame, event.length, packet)) return;
  const char* secret = criminiFindNodeSecret(packet.nodeSerial);
  if (!secret || !criminiVerifyPacket(packet, secret) || criminiAlreadySeen(packet)) return;
  if (criminiPendingCount >= CRIMINI_GATEWAY_QUEUE_SIZE) {
    Serial.println("Gateway queue full; reading not accepted.");
    return;
  }

  criminiRememberPacket(packet);
  CriminiQueuedReading& queued = criminiPending[criminiPendingCount++];
  queued.packet = packet;
  queued.rssi = event.rssi;
  queued.lqi = event.lqi;
  queued.receivedAt = time(nullptr);
  Serial.printf("Queued %s seq=%lu temp=%.2fF (%u pending)\n", packet.nodeSerial,
                static_cast<unsigned long>(packet.sequence), packet.tempCentiF / 100.0f,
                static_cast<unsigned>(criminiPendingCount));
}

inline bool criminiConnectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(CRIMINI_WIFI_SSID, CRIMINI_WIFI_PASSWORD);
  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) delay(100);
  return WiFi.status() == WL_CONNECTED;
}

inline bool criminiSyncClock() {
  if (time(nullptr) > 1700000000) return true;
  configTime(0, 0, "time.cloudflare.com", "pool.ntp.org");
  const uint32_t started = millis();
  while (time(nullptr) <= 1700000000 && millis() - started < 10000) delay(100);
  return time(nullptr) > 1700000000;
}

inline void criminiStopWifi() {
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_OFF);
}

inline String criminiJsonBody() {
  String body = "{\"readings\":[";
  body.reserve(300 * criminiPendingCount + 24);
  for (size_t i = 0; i < criminiPendingCount; ++i) {
    const CriminiQueuedReading& row = criminiPending[i];
    if (i) body += ',';
    body += "{\"node_serial\":\"";
    body += row.packet.nodeSerial;
    body += "\",\"temperature\":";
    body += String(row.packet.tempCentiF / 100.0f, 2);
    body += ",\"humidity_pct\":";
    body += String(row.packet.humidityCentiPct / 100.0f, 2);
    body += ",\"packet_sequence\":";
    body += String(row.packet.sequence);
    body += ",\"wake_nonce\":\"";
    char nonce[9];
    snprintf(nonce, sizeof(nonce), "%08lx", static_cast<unsigned long>(row.packet.wakeNonce));
    body += nonce;
    body += '"';
    if (row.packet.batteryMv > 0) {
      body += ",\"battery_mv\":";
      body += String(row.packet.batteryMv);
    }
    body += ",\"rssi\":";
    body += String(row.rssi);
    body += ",\"lqi\":";
    body += String(row.lqi);
    if (row.receivedAt > 1700000000) {
      body += ",\"ts\":";
      body += String(static_cast<uint32_t>(row.receivedAt));
    }
    body += '}';
  }
  body += "]}";
  return body;
}

inline bool criminiPostPending() {
  if (criminiPendingCount == 0) return true;
  if (esp_ieee802154_sleep() != ESP_OK) {
    Serial.println("Could not pause radio for Wi-Fi upload.");
    return false;
  }

  bool accepted = false;
  if (criminiConnectWifi() && criminiSyncClock()) {
    WiFiClientSecure client;
    client.setCACert(CRIMINI_TLS_ROOT_CA_PEM);
    HTTPClient http;
    const String url = String(CRIMINI_API_BASE_URL) + "/api/temps";
    http.setConnectTimeout(8000);
    http.setTimeout(12000);
    if (http.begin(client, url)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-device-id", CRIMINI_GATEWAY_SERIAL);
      http.addHeader("x-device-key", CRIMINI_GATEWAY_DEVICE_KEY);
      const int status = http.POST(criminiJsonBody());
      const String response = http.getString();
      const int field = response.indexOf("\"accepted\":");
      const int acceptedCount = field >= 0 ? response.substring(field + 11).toInt() : -1;
      accepted = (status == 200 || status == 201) &&
                 acceptedCount == static_cast<int>(criminiPendingCount);
      Serial.printf("POST /api/temps status=%d accepted=%d/%u\n", status, acceptedCount,
                    static_cast<unsigned>(criminiPendingCount));
      http.end();
    }
  } else {
    Serial.println("Wi-Fi or clock unavailable; retaining queued readings.");
  }
  criminiStopWifi();
  if (esp_ieee802154_receive() != ESP_OK) Serial.println("Radio resume failed.");
  if (accepted) criminiPendingCount = 0;
  return accepted;
}

inline void criminiGatewaySetup() {
  if (!criminiValidSerial(CRIMINI_GATEWAY_SERIAL) ||
      strlen(CRIMINI_GATEWAY_DEVICE_KEY) < 32 || !CRIMINI_WIFI_SSID[0] ||
      !CRIMINI_TLS_ROOT_CA_PEM[0] || !criminiHasKnownNode() ||
      strncmp(CRIMINI_API_BASE_URL, "https://", 8) != 0) {
    Serial.println("Gateway configuration incomplete; radio and upload disabled.");
    return;
  }
  criminiRadioEvents = xQueueCreate(16, sizeof(CriminiRadioEvent));
  if (!criminiRadioEvents || !criminiRadioBegin(true, CRIMINI_GATEWAY_SHORT_ADDR) ||
      esp_ieee802154_receive() != ESP_OK) {
    Serial.println("Gateway radio initialization failed.");
    return;
  }
  criminiLastPostMs = millis();
  Serial.printf("Gateway %s listening on channel %u\n", CRIMINI_GATEWAY_SERIAL,
                static_cast<unsigned>(CRIMINI_RADIO_CHANNEL));
}

inline void criminiGatewayLoop() {
  if (!criminiRadioEvents) {
    delay(1000);
    return;
  }
  CriminiRadioEvent event = {};
  if (xQueueReceive(criminiRadioEvents, &event, pdMS_TO_TICKS(100)) == pdTRUE) {
    criminiHandleRadioEvent(event);
    if (esp_ieee802154_receive() != ESP_OK) Serial.println("Radio receive restart failed.");
  }
  if (criminiPendingCount > 0 &&
      (criminiPendingCount >= CRIMINI_GATEWAY_QUEUE_SIZE ||
       millis() - criminiLastPostMs >= CRIMINI_GATEWAY_POST_INTERVAL_MS)) {
    criminiPostPending();
    criminiLastPostMs = millis();
  }
}
