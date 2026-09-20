#pragma once

#include <Arduino.h>
#include <esp_ieee802154.h>
#include <mbedtls/md.h>
#include <stddef.h>
#include <string.h>

static constexpr uint16_t CRIMINI_PACKET_MAGIC = 0x4352;
static constexpr uint8_t CRIMINI_PACKET_VERSION = 3;
static constexpr uint8_t CRIMINI_PACKET_TYPE_TEMP = 1;
static constexpr size_t CRIMINI_SERIAL_SIZE = 32;
static constexpr size_t CRIMINI_HMAC_SIZE = 32;
static constexpr size_t CRIMINI_MAC_HEADER_SIZE = 9;
static constexpr size_t CRIMINI_MAC_FCS_SIZE = 2;
static constexpr uint16_t CRIMINI_MAC_FCF = 0x8841;

struct __attribute__((packed)) CriminiTempPacket {
  uint16_t magic;
  uint8_t version;
  uint8_t packetType;
  uint32_t sequence;
  uint32_t wakeNonce;
  char nodeSerial[CRIMINI_SERIAL_SIZE];
  int32_t tempCentiF;
  uint16_t humidityCentiPct;
  uint16_t batteryMv;
  uint8_t reserved[8];
  uint8_t hmac[CRIMINI_HMAC_SIZE];
};

static_assert(sizeof(CriminiTempPacket) + CRIMINI_MAC_HEADER_SIZE + CRIMINI_MAC_FCS_SIZE <= 127,
              "Temperature packet exceeds an IEEE 802.15.4 frame");

inline bool criminiValidSerial(const char* serial) {
  const size_t length = serial ? strnlen(serial, CRIMINI_SERIAL_SIZE) : 0;
  if (length == 0 || length >= CRIMINI_SERIAL_SIZE) return false;
  for (size_t i = 0; i < length; ++i) {
    const char ch = serial[i];
    if (!((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-')) return false;
  }
  return true;
}

inline bool criminiPacketHmac(const CriminiTempPacket& packet, const char* secret,
                             uint8_t output[CRIMINI_HMAC_SIZE]) {
  if (!secret || strlen(secret) < 32) return false;
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  return info && mbedtls_md_hmac(info, reinterpret_cast<const uint8_t*>(secret), strlen(secret),
                                  reinterpret_cast<const uint8_t*>(&packet),
                                  offsetof(CriminiTempPacket, hmac), output) == 0;
}

inline bool criminiSignPacket(CriminiTempPacket& packet, const char* secret) {
  memset(packet.hmac, 0, sizeof(packet.hmac));
  return criminiPacketHmac(packet, secret, packet.hmac);
}

inline bool criminiVerifyPacket(const CriminiTempPacket& packet, const char* secret) {
  uint8_t expected[CRIMINI_HMAC_SIZE] = {};
  if (!criminiPacketHmac(packet, secret, expected)) return false;
  uint8_t difference = 0;
  for (size_t i = 0; i < CRIMINI_HMAC_SIZE; ++i) difference |= expected[i] ^ packet.hmac[i];
  return difference == 0;
}

inline bool criminiRadioBegin(bool gateway, uint16_t shortAddress) {
  if (CRIMINI_RADIO_CHANNEL < 11 || CRIMINI_RADIO_CHANNEL > 26 ||
      CRIMINI_RADIO_TX_POWER_DBM > 0 || CRIMINI_RADIO_TX_POWER_DBM < -20) return false;
  return esp_ieee802154_enable() == ESP_OK &&
         esp_ieee802154_set_channel(CRIMINI_RADIO_CHANNEL) == ESP_OK &&
         esp_ieee802154_set_txpower(CRIMINI_RADIO_TX_POWER_DBM) == ESP_OK &&
         esp_ieee802154_set_panid(CRIMINI_RADIO_PAN_ID) == ESP_OK &&
         esp_ieee802154_set_short_address(shortAddress) == ESP_OK &&
         esp_ieee802154_set_promiscuous(false) == ESP_OK &&
         esp_ieee802154_set_coordinator(gateway) == ESP_OK &&
         esp_ieee802154_set_rx_when_idle(gateway) == ESP_OK;
}

inline size_t criminiBuildFrame(uint8_t* frame, size_t capacity, uint8_t macSequence,
                               const CriminiTempPacket& packet) {
  const size_t phyLength = CRIMINI_MAC_HEADER_SIZE + sizeof(packet) + CRIMINI_MAC_FCS_SIZE;
  const size_t storedLength = 1 + CRIMINI_MAC_HEADER_SIZE + sizeof(packet);
  if (!frame || phyLength > 127 || storedLength > capacity) return 0;
  frame[0] = static_cast<uint8_t>(phyLength);
  frame[1] = static_cast<uint8_t>(CRIMINI_MAC_FCF);
  frame[2] = static_cast<uint8_t>(CRIMINI_MAC_FCF >> 8);
  frame[3] = macSequence;
  frame[4] = static_cast<uint8_t>(CRIMINI_RADIO_PAN_ID);
  frame[5] = static_cast<uint8_t>(CRIMINI_RADIO_PAN_ID >> 8);
  frame[6] = static_cast<uint8_t>(CRIMINI_GATEWAY_SHORT_ADDR);
  frame[7] = static_cast<uint8_t>(CRIMINI_GATEWAY_SHORT_ADDR >> 8);
  frame[8] = static_cast<uint8_t>(CRIMINI_NODE_SHORT_ADDR);
  frame[9] = static_cast<uint8_t>(CRIMINI_NODE_SHORT_ADDR >> 8);
  memcpy(frame + 1 + CRIMINI_MAC_HEADER_SIZE, &packet, sizeof(packet));
  return storedLength;
}

inline bool criminiParseFrame(const uint8_t* frame, size_t storedLength, CriminiTempPacket& packet) {
  const size_t expectedPhyLength = CRIMINI_MAC_HEADER_SIZE + sizeof(packet) + CRIMINI_MAC_FCS_SIZE;
  if (!frame || frame[0] != expectedPhyLength ||
      storedLength < 1 + CRIMINI_MAC_HEADER_SIZE + sizeof(packet)) return false;
  if (frame[1] != static_cast<uint8_t>(CRIMINI_MAC_FCF) ||
      frame[2] != static_cast<uint8_t>(CRIMINI_MAC_FCF >> 8)) return false;
  const uint16_t pan = static_cast<uint16_t>(frame[4]) | (static_cast<uint16_t>(frame[5]) << 8);
  const uint16_t dest = static_cast<uint16_t>(frame[6]) | (static_cast<uint16_t>(frame[7]) << 8);
  const uint16_t source = static_cast<uint16_t>(frame[8]) | (static_cast<uint16_t>(frame[9]) << 8);
  if (pan != CRIMINI_RADIO_PAN_ID || dest != CRIMINI_GATEWAY_SHORT_ADDR ||
      source != CRIMINI_NODE_SHORT_ADDR) return false;
  memcpy(&packet, frame + 1 + CRIMINI_MAC_HEADER_SIZE, sizeof(packet));
  return packet.magic == CRIMINI_PACKET_MAGIC &&
         packet.version == CRIMINI_PACKET_VERSION &&
         packet.packetType == CRIMINI_PACKET_TYPE_TEMP &&
         memchr(packet.nodeSerial, '\0', CRIMINI_SERIAL_SIZE) != nullptr &&
         criminiValidSerial(packet.nodeSerial) &&
         packet.humidityCentiPct <= 10000;
}
