#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <esp_crt_bundle.h>
#include <esp_http_client.h>
#include <esp_ieee802154.h>
#include <esp_wifi.h>
#include <esp_random.h>
#include <esp_timer.h>
#include <freertos/queue.h>
#include <mbedtls/md.h>
#include <time.h>
#include "GatewaySetupPage.h"

#ifndef ARDUINO_XIAO_ESP32C6
#error "Select XIAO_ESP32C6 in Arduino IDE for this gateway."
#endif

// Set these before uploading the gateway.
const char GATEWAY_SERIAL[] = "";
const char FACTORY_GATEWAY_CREDENTIAL[] = "";
const char RADIO_SECRET[] = "";
const char API_URL[] = "https://criminiops.com/api/temps";

constexpr uint8_t RADIO_CHANNEL = 20;
constexpr uint16_t RADIO_PAN = 0xC110;
constexpr uint16_t GATEWAY_ADDRESS = 0x0001;
constexpr size_t MAX_PENDING_NODES = 25;
constexpr size_t AUTH_TAG_SIZE = 16;
constexpr size_t RECENT_PACKET_COUNT = 128;
constexpr size_t RADIO_QUEUE_DEPTH = 64;
constexpr size_t MAX_FRAMES_PER_LOOP = 32;
constexpr uint32_t BATCH_WINDOW_MS = 120000;
constexpr uint32_t RADIO_QUIET_PERIOD_MS = 1500;
constexpr uint32_t RETRY_INTERVAL_MS = 60000;
constexpr uint32_t RADIO_SILENCE_RECOVERY_MS = 720000;
constexpr uint32_t WIFI_SETUP_AFTER_FAILURE_MS = 600000;
constexpr uint32_t WIFI_SETUP_TIMEOUT_MS = 600000;
constexpr uint32_t GATEWAY_STATUS_INTERVAL_MS = 300000;

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
  int64_t receivedAtUs;
};

QueuedReading readings[MAX_PENDING_NODES] = {};
size_t readingCount = 0;
uint32_t batchStartedAt = 0;
uint32_t retryAt = 0;
bool retryScheduled = false;
uint32_t lastAuthenticatedPacket = 0;
uint32_t lastRadioRecovery = 0;
uint8_t consecutiveRadioRecoveries = 0;
QueueHandle_t receivedFrames = nullptr;
RecentPacket recentPackets[RECENT_PACKET_COUNT] = {};
size_t recentPacketCount = 0;
size_t nextRecentPacket = 0;
uint32_t lastRadioDiagnostic = 0;
uint32_t wifiFailureSince = 0;
uint32_t lastGatewayContact = 0;
uint32_t lastGatewayStatusAttempt = 0;
char provisioningServiceName[33] = {};
char provisioningProof[33] = {};

bool sendGatewayStatus();

bool buildProvisioningIdentity() {
  const mbedtls_md_info_t* sha256 = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!sha256) return false;

  uint8_t credentialHash[32] = {};
  uint8_t proofDigest[32] = {};
  if (mbedtls_md(sha256,
                 reinterpret_cast<const uint8_t*>(FACTORY_GATEWAY_CREDENTIAL),
                 strlen(FACTORY_GATEWAY_CREDENTIAL),
                 credentialHash) != 0) return false;

  char message[64] = {};
  snprintf(message, sizeof(message), "crimini-setup-wifi-v1:%s", GATEWAY_SERIAL);
  if (mbedtls_md_hmac(sha256,
                      credentialHash,
                      sizeof(credentialHash),
                      reinterpret_cast<const uint8_t*>(message),
                      strlen(message),
                      proofDigest) != 0) {
    memset(credentialHash, 0, sizeof(credentialHash));
    return false;
  }

  const size_t serialLength = strlen(GATEWAY_SERIAL);
  const char* suffix = serialLength > 24 ? GATEWAY_SERIAL + serialLength - 24 : GATEWAY_SERIAL;
  snprintf(provisioningServiceName, sizeof(provisioningServiceName), "Crimini-%s", suffix);
  for (size_t index = 0; index < 16; ++index) {
    snprintf(provisioningProof + index * 2, 3, "%02x", proofDigest[index]);
  }
  provisioningProof[32] = '\0';
  memset(credentialHash, 0, sizeof(credentialHash));
  memset(proofDigest, 0, sizeof(proofDigest));
  return true;
}

bool hasStoredWifiCredentials() {
  WiFi.mode(WIFI_STA);
  wifi_config_t configuration = {};
  return esp_wifi_get_config(WIFI_IF_STA, &configuration) == ESP_OK && configuration.sta.ssid[0] != '\0';
}

String jsonString(const String& value) {
  String result = "\"";
  for (size_t index = 0; index < value.length(); ++index) {
    const uint8_t c = value[index];
    if (c == '"' || c == '\\') {
      result += '\\';
      result += static_cast<char>(c);
    } else if (c < 0x20) {
      char escaped[7];
      snprintf(escaped, sizeof(escaped), "\\u%04x", c);
      result += escaped;
    } else result += static_cast<char>(c);
  }
  return result + '"';
}

bool runGatewayWifiSetup() {
  if (!buildProvisioningIdentity()) return false;
  WiFi.mode(WIFI_AP_STA);
  WiFi.setAutoReconnect(false);
  wifi_config_t previous = {};
  const bool hadStoredNetwork = esp_wifi_get_config(WIFI_IF_STA, &previous) == ESP_OK && previous.sta.ssid[0];
  WiFi.disconnect(false, false);
  // Test new credentials in RAM; commit only after the authenticated cloud check succeeds.
  if (esp_wifi_set_storage(WIFI_STORAGE_RAM) != ESP_OK ||
      !WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0)) ||
      !WiFi.softAP(provisioningServiceName, provisioningProof, 1, false, 1)) {
    esp_wifi_set_storage(WIFI_STORAGE_FLASH);
    WiFi.mode(WIFI_OFF);
    memset(&previous, 0, sizeof(previous));
    memset(provisioningProof, 0, sizeof(provisioningProof));
    return false;
  }
  memset(provisioningProof, 0, sizeof(provisioningProof));

  uint8_t nonce[16];
  char setupToken[33] = {};
  esp_fill_random(nonce, sizeof(nonce));
  for (size_t index = 0; index < sizeof(nonce); ++index) snprintf(setupToken + index * 2, 3, "%02x", nonce[index]);
  memset(nonce, 0, sizeof(nonce));

  WebServer server(IPAddress(192, 168, 4, 1), 80);
  DNSServer dns;
  const char* headers[] = { "X-Setup-Token", "Origin", "Content-Length" };
  server.collectHeaders(headers, 3);
  const uint32_t openedAt = millis();
  uint32_t joinStartedAt = 0, lastStoredRetry = openedAt, lastCloudCheck = 0, connectedAt = 0;
  bool needsJoin = false, joining = false, checkingCloud = false, connected = false, finish = false;
  bool scanStarted = false, testingStoredNetwork = false;
  char pendingSsid[33] = {}, pendingPassword[64] = {};
  String state = "ready", statusMessage = "";

  auto reply = [&](int status, const String& body) {
    server.sendHeader("Cache-Control", "no-store");
    server.sendHeader("X-Content-Type-Options", "nosniff");
    server.send(status, "application/json", body);
  };
  auto authorized = [&]() {
    const String host = server.hostHeader();
    const String origin = server.header("Origin");
    const String supplied = server.header("X-Setup-Token");
    uint8_t diff = supplied.length() == 32 ? 0 : 1;
    for (size_t index = 0; index < 32; ++index) diff |= setupToken[index] ^ (index < supplied.length() ? supplied[index] : 0);
    if ((host != "192.168.4.1" && host != "192.168.4.1:80") ||
        (origin.length() && origin != "http://192.168.4.1") || diff) {
      reply(403, "{\"error\":\"Reopen gateway setup.\"}");
      return false;
    }
    return true;
  };
  server.on("/", HTTP_GET, [&]() {
    if (server.hostHeader() != "192.168.4.1" && server.hostHeader() != "192.168.4.1:80") {
      server.sendHeader("Location", "http://192.168.4.1/");
      server.send(302);
      return;
    }
    String page(FPSTR(GATEWAY_SETUP_PAGE));
    page.replace("%TOKEN%", setupToken);
    page.replace("%SERIAL%", GATEWAY_SERIAL);
    server.sendHeader("Cache-Control", "no-store");
    server.sendHeader("Referrer-Policy", "no-referrer");
    server.sendHeader("X-Content-Type-Options", "nosniff");
    server.sendHeader("Content-Security-Policy", "default-src 'none'; script-src 'nonce-" + String(setupToken) +
      "'; style-src 'nonce-" + String(setupToken) + "'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    server.send(200, "text/html; charset=utf-8", page);
  });
  server.on("/networks", HTTP_GET, [&]() {
    if (!authorized()) return;
    if (joining || checkingCloud || connected) { reply(409, "{\"error\":\"Wait for the connection to finish.\"}"); return; }
    if (!scanStarted) { WiFi.scanNetworks(true); scanStarted = true; }
    const int count = WiFi.scanComplete();
    if (count == WIFI_SCAN_RUNNING) { reply(202, "{\"scanning\":true}"); return; }
    String body = "{\"networks\":[";
    size_t added = 0;
    for (int index = 0; index < count && added < 25; ++index) {
      const String ssid = WiFi.SSID(index);
      if (!ssid.length() || ssid == provisioningServiceName) continue;
      bool duplicate = false;
      for (int earlier = 0; earlier < index; ++earlier) if (WiFi.SSID(earlier) == ssid) { duplicate = true; break; }
      if (duplicate) continue;
      if (added++) body += ',';
      body += jsonString(ssid);
    }
    WiFi.scanDelete(); scanStarted = false;
    reply(count < 0 ? 503 : 200, count < 0 ? "{\"error\":\"Network search failed. Try again.\"}" : body + "]}");
  });
  server.on("/connect", HTTP_POST, [&]() {
    if (!authorized()) return;
    if (joining || checkingCloud || connected || scanStarted) { reply(409, "{\"error\":\"Wait a moment, then try again.\"}"); return; }
    const String ssid = server.arg("ssid"), password = server.arg("password");
    if (server.header("Content-Length").toInt() > 1024 || !ssid.length() || ssid.length() > 32 ||
        password.length() > 63 || (password.length() && password.length() < 8) ||
        strlen(ssid.c_str()) != ssid.length() || strlen(password.c_str()) != password.length()) {
      reply(400, "{\"error\":\"Check the network name and password.\"}"); return;
    }
    ssid.toCharArray(pendingSsid, sizeof(pendingSsid));
    password.toCharArray(pendingPassword, sizeof(pendingPassword));
    testingStoredNetwork = false;
    needsJoin = true;
    reply(202, "{\"connecting\":true}");
  });
  server.on("/status", HTTP_GET, [&]() {
    if (authorized()) reply(200, "{\"state\":" + jsonString(state) + ",\"message\":" + jsonString(statusMessage) + "}");
  });
  server.on("/finish", HTTP_POST, [&]() {
    if (!authorized()) return;
    if (!connected) { reply(409, "{\"error\":\"Finish connecting first.\"}"); return; }
    finish = true;
    reply(200, "{\"complete\":true}");
  });
  server.onNotFound([&]() {
    if (server.method() != HTTP_GET) { reply(404, "{\"error\":\"Not found.\"}"); return; }
    server.sendHeader("Location", "http://192.168.4.1/"); server.send(302);
  });
  if (!dns.start(53, "*", IPAddress(192, 168, 4, 1))) {
    Serial.println("Gateway setup: open http://192.168.4.1/ directly");
  }
  server.begin();
  Serial.printf("Gateway Wi-Fi setup ready: %s\n", provisioningServiceName);

  while (!finish && (!hadStoredNetwork || millis() - openedAt < WIFI_SETUP_TIMEOUT_MS)) {
    dns.processNextRequest(); server.handleClient();
    const uint32_t now = millis();
    if (connected && now - connectedAt >= 30000) break;
    if (!connected && !needsJoin && !joining && !checkingCloud && !scanStarted && hadStoredNetwork &&
        WiFi.softAPgetStationNum() == 0 && now - lastStoredRetry >= 30000) {
      memcpy(pendingSsid, previous.sta.ssid, 32);
      memcpy(pendingPassword, previous.sta.password, 63);
      testingStoredNetwork = true; needsJoin = true; lastStoredRetry = now;
    }
    if (needsJoin) {
      WiFi.disconnect(false, false);
      WiFi.begin(pendingSsid, pendingPassword);
      memset(pendingSsid, 0, sizeof(pendingSsid)); memset(pendingPassword, 0, sizeof(pendingPassword));
      needsJoin = false; joining = true; joinStartedAt = now;
      state = "joining"; statusMessage = "Connecting to Wi-Fi...";
    }
    if (joining && WiFi.status() == WL_CONNECTED) {
      joining = false; checkingCloud = true; lastCloudCheck = now - 15000;
      state = "verifying"; statusMessage = "Wi-Fi connected. Connecting to Crimini...";
    } else if (joining && now - joinStartedAt >= 20000) {
      WiFi.disconnect(false, false); joining = false;
      state = testingStoredNetwork ? "ready" : "error";
      statusMessage = testingStoredNetwork ? "" : "Could not join Wi-Fi. Check the password and try again.";
    }
    if (checkingCloud && now - lastCloudCheck >= 15000) {
      lastCloudCheck = now;
      if (WiFi.status() != WL_CONNECTED) {
        checkingCloud = false; state = "error"; statusMessage = "Wi-Fi disconnected. Try connecting again.";
      } else if (sendGatewayStatus()) {
        wifi_config_t accepted = {};
        const bool saved = esp_wifi_get_config(WIFI_IF_STA, &accepted) == ESP_OK &&
          esp_wifi_set_storage(WIFI_STORAGE_FLASH) == ESP_OK && esp_wifi_set_config(WIFI_IF_STA, &accepted) == ESP_OK;
        memset(&accepted, 0, sizeof(accepted));
        esp_wifi_set_storage(WIFI_STORAGE_RAM);
        checkingCloud = false;
        if (saved) { connected = true; connectedAt = millis(); state = "connected"; statusMessage = "Connected to Crimini."; }
        else { state = "error"; statusMessage = "Could not save Wi-Fi. Try connecting again."; }
      } else if (now - joinStartedAt >= 90000) {
        checkingCloud = false; state = "error"; statusMessage = "Wi-Fi connected, but Crimini could not be reached. Check the restaurant's internet and try again.";
      }
    }
    delay(10);
  }
  server.stop(); dns.stop(); WiFi.scanDelete();
  WiFi.disconnect(false, false); WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  esp_wifi_set_storage(WIFI_STORAGE_FLASH);
  if (!connected) esp_wifi_set_config(WIFI_IF_STA, &previous);
  memset(&previous, 0, sizeof(previous)); memset(setupToken, 0, sizeof(setupToken));
  memset(pendingSsid, 0, sizeof(pendingSsid)); memset(pendingPassword, 0, sizeof(pendingPassword));
  WiFi.setAutoReconnect(true);
  WiFi.mode(WIFI_OFF);
  return connected;
}

bool provisionWifiIfNeeded() {
  const bool stored = hasStoredWifiCredentials();
  if (stored) {
    WiFi.begin();
    const uint32_t started = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - started < 7000) delay(100);
    if (WiFi.status() == WL_CONNECTED) {
      sendGatewayStatus();
      WiFi.disconnect(true, false); WiFi.mode(WIFI_OFF);
      return true;
    }
    WiFi.disconnect(true, false); WiFi.mode(WIFI_OFF);
    // Keep receiving normally through short router outages before offering network setup.
    wifiFailureSince = millis();
    return true;
  }
  const bool connected = runGatewayWifiSetup();
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_OFF);
  return connected;
}

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
  const QueuedReading reading = { packet, rssi, lqi, esp_timer_get_time() };
  for (size_t i = 0; i < readingCount; ++i) {
    if (strcmp(readings[i].packet.serial, packet.serial) == 0) {
      readings[i] = reading;
      return;
    }
  }

  if (readingCount < MAX_PENDING_NODES) {
    if (!readingCount) batchStartedAt = millis();
    readings[readingCount++] = reading;
    return;
  }

  size_t oldest = 0;
  for (size_t i = 1; i < readingCount; ++i) {
    if (readings[i].receivedAtUs < readings[oldest].receivedAtUs) oldest = i;
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
  if (incoming.length < headerSize + 1) return;
  if ((incoming.bytes[1] != 0x41 && incoming.bytes[1] != 0x61) || incoming.bytes[2] != 0x88) {
    return;
  }
  if (incoming.bytes[4] != (RADIO_PAN & 0xFF) || incoming.bytes[5] != (RADIO_PAN >> 8) ||
      incoming.bytes[6] != (GATEWAY_ADDRESS & 0xFF) || incoming.bytes[7] != (GATEWAY_ADDRESS >> 8)) {
    return;
  }
  if (incoming.length != expectedLength + 1) {
    const uint32_t now = millis();
    if (now - lastRadioDiagnostic >= 1000) {
      lastRadioDiagnostic = now;
      Serial.printf("Radio: Crimini frame length %u, expected %u\n",
                    static_cast<unsigned>(incoming.length),
                    static_cast<unsigned>(expectedLength + 1));
    }
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
  WiFi.begin();
  const uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 7000) delay(100);
  if (WiFi.status() != WL_CONNECTED) {
    if (!wifiFailureSince) wifiFailureSince = millis();
    return false;
  }
  wifiFailureSince = 0;
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
    // Reconstruct capture time after NTP, including readings received before the clock was set.
    const int64_t ageSeconds = (esp_timer_get_time() - reading.receivedAtUs) / 1000000LL;
    const uint32_t measuredAt = static_cast<uint32_t>(time(nullptr) - ageSeconds);
    body += ",\"ts\":" + String(measuredAt);
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

bool sendGatewayStatus() {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (time(nullptr) < 1700000000) {
    configTime(0, 0, "time.cloudflare.com", "pool.ntp.org");
    const uint32_t started = millis();
    while (time(nullptr) < 1700000000 && millis() - started < 10000) delay(100);
    if (time(nullptr) < 1700000000) return false;
  }
  String response;
  esp_http_client_config_t config = {};
  config.url = API_URL;
  config.crt_bundle_attach = esp_crt_bundle_attach;
  config.event_handler = onHttpEvent;
  config.user_data = &response;
  config.timeout_ms = 10000;
  esp_http_client_handle_t request = esp_http_client_init(&config);
  if (!request) return false;
  const char body[] = "{\"gateway_status\":true}";
  esp_http_client_set_method(request, HTTP_METHOD_POST);
  esp_http_client_set_header(request, "Content-Type", "application/json");
  esp_http_client_set_header(request, "x-device-id", GATEWAY_SERIAL);
  esp_http_client_set_header(request, "x-device-key", FACTORY_GATEWAY_CREDENTIAL);
  esp_http_client_set_post_field(request, body, sizeof(body) - 1);
  const esp_err_t result = esp_http_client_perform(request);
  const bool connected = result == ESP_OK && esp_http_client_get_status_code(request) == 200 &&
    response.indexOf("\"connected\":true") >= 0;
  esp_http_client_cleanup(request);
  if (connected) lastGatewayContact = millis();
  return connected;
}

void checkIdleGatewayConnection() {
  lastGatewayStatusAttempt = millis();
  if (!pauseRadioForWifi()) return;
  const bool connected = connectWifi() && sendGatewayStatus();
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_OFF);
  delay(20);
  if (!resumeRadioReceiver() && !resetRadioReceiver()) reportRadioIssue("receiver did not resume after gateway check-in");
  Serial.println(connected ? "Gateway cloud check-in succeeded" : "Gateway cloud check-in unavailable; will retry");
}

bool uploadReadings() {
  const size_t submittedCount = readingCount;
  if (!submittedCount) return true;
  if (!pauseRadioForWifi()) {
    reportRadioIssue("receiver did not pause for upload");
    if (!resetRadioReceiver()) {
      Serial.println("Radio: recovery failed; restarting gateway");
      delay(100);
      ESP.restart();
    }
    return false;
  }

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
      if (uploaded) lastGatewayContact = millis();
      Serial.printf("Crimini upload: HTTP %d, accepted %d, rejected %d/%u\n", status, accepted, rejected,
                    static_cast<unsigned>(submittedCount));
      esp_http_client_cleanup(request);
    }
  }
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_OFF);
  if (uploaded && submittedCount) {
    readingCount = 0;
    batchStartedAt = 0;
    retryAt = 0;
    retryScheduled = false;
  }
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
      strlen(RADIO_SECRET) < 16) {
    Serial.println("Complete gateway factory setup before uploading.");
    return;
  }
  // XIAO ESP32C6 defaults to its ceramic antenna; route both radios to the external connector.
  pinMode(WIFI_ENABLE, OUTPUT);
  digitalWrite(WIFI_ENABLE, LOW);
  delay(100);
  pinMode(WIFI_ANT_CONFIG, OUTPUT);
  digitalWrite(WIFI_ANT_CONFIG, HIGH);

  if (!provisionWifiIfNeeded()) {
    Serial.println("Gateway Wi-Fi setup could not start");
    return;
  }

  receivedFrames = xQueueCreate(RADIO_QUEUE_DEPTH, sizeof(RadioFrame));
  if (!receivedFrames) return;
  if (!resumeRadioReceiver()) {
    Serial.println("Radio: receiver failed to start");
    return;
  }
  const uint32_t now = millis();
  lastAuthenticatedPacket = now;
  lastRadioRecovery = now;
  lastGatewayStatusAttempt = now;
  Serial.printf("Gateway %s listening on channel %u\n", GATEWAY_SERIAL, RADIO_CHANNEL);
}

void loop() {
  if (wifiFailureSince && millis() - wifiFailureSince >= WIFI_SETUP_AFTER_FAILURE_MS) {
    if (pauseRadioForWifi() && esp_ieee802154_disable() == ESP_OK) {
      runGatewayWifiSetup();
      wifiFailureSince = 0;
      lastAuthenticatedPacket = millis();
      lastRadioRecovery = millis();
      consecutiveRadioRecoveries = 0;
      if (!resumeRadioReceiver()) reportRadioIssue("receiver did not resume after Wi-Fi setup");
    }
  }
  RadioFrame incoming = {};
  size_t processedFrames = 0;
  while (receivedFrames && processedFrames < MAX_FRAMES_PER_LOOP &&
         xQueueReceive(receivedFrames, &incoming, processedFrames ? 0 : pdMS_TO_TICKS(20)) == pdTRUE) {
    receiveReading(incoming);
    if (!resumeRadioReceiver()) reportRadioIssue("receiver did not continue after frame");
    ++processedFrames;
  }
  const uint32_t now = millis();
  const bool retryDue = retryScheduled && static_cast<int32_t>(now - retryAt) >= 0;
  const bool batchDue = readingCount && now - batchStartedAt >= BATCH_WINDOW_MS;
  const bool batchFull = readingCount >= MAX_PENDING_NODES;
  const bool radioQuiet = now - lastAuthenticatedPacket >= RADIO_QUIET_PERIOD_MS;
  const bool uploadDue = retryScheduled ? retryDue : (batchDue || batchFull);
  if (!readingCount && now - lastGatewayContact >= GATEWAY_STATUS_INTERVAL_MS &&
      now - lastGatewayStatusAttempt >= GATEWAY_STATUS_INTERVAL_MS && radioQuiet) {
    checkIdleGatewayConnection();
  }
  if (readingCount && uploadDue && radioQuiet) {
    if (!uploadReadings()) {
      retryAt = millis() + RETRY_INTERVAL_MS;
      retryScheduled = true;
    }
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
