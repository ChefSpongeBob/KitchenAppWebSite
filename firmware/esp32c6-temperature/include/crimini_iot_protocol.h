#pragma once

#include <Arduino.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <mbedtls/md.h>

static constexpr uint16_t CRIMINI_PACKET_MAGIC = 0x4352;
static constexpr uint8_t CRIMINI_PACKET_VERSION = 1;
static constexpr uint8_t CRIMINI_PACKET_TYPE_TEMP = 1;
static constexpr size_t CRIMINI_HMAC_SIZE = 32;
static constexpr size_t CRIMINI_SERIAL_SIZE = 32;

struct __attribute__((packed)) CriminiTempPacket {
  uint16_t magic;
  uint8_t version;
  uint8_t packetType;
  uint32_t sequence;
  uint32_t uptimeSeconds;
  char nodeSerial[CRIMINI_SERIAL_SIZE];
  int32_t tempCentiF;
  uint16_t batteryMv;
  int8_t packetRssi;
  uint8_t reserved[7];
  uint8_t hmac[CRIMINI_HMAC_SIZE];
};

static_assert(sizeof(CriminiTempPacket) <= 250, "ESP-NOW packet must fit one frame");

inline bool criminiComputeHmac(const uint8_t* data, size_t length, const char* secret, uint8_t out[CRIMINI_HMAC_SIZE]) {
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!info || !secret || !secret[0]) return false;
  return mbedtls_md_hmac(info, reinterpret_cast<const uint8_t*>(secret), strlen(secret), data, length, out) == 0;
}

inline bool criminiTimingSafeEqual(const uint8_t* a, const uint8_t* b, size_t length) {
  uint8_t diff = 0;
  for (size_t i = 0; i < length; ++i) diff |= a[i] ^ b[i];
  return diff == 0;
}

inline void criminiCopySerial(char (&dest)[CRIMINI_SERIAL_SIZE], const char* serial) {
  memset(dest, 0, CRIMINI_SERIAL_SIZE);
  if (!serial) return;
  strncpy(dest, serial, CRIMINI_SERIAL_SIZE - 1);
}

inline size_t criminiSignedLength() {
  return offsetof(CriminiTempPacket, hmac);
}

inline bool criminiSignPacket(CriminiTempPacket& packet, const char* secret) {
  memset(packet.hmac, 0, sizeof(packet.hmac));
  return criminiComputeHmac(reinterpret_cast<const uint8_t*>(&packet), criminiSignedLength(), secret, packet.hmac);
}

inline bool criminiVerifyPacket(const CriminiTempPacket& packet, const char* secret) {
  uint8_t expected[CRIMINI_HMAC_SIZE] = {0};
  if (!criminiComputeHmac(reinterpret_cast<const uint8_t*>(&packet), criminiSignedLength(), secret, expected)) return false;
  return criminiTimingSafeEqual(expected, packet.hmac, CRIMINI_HMAC_SIZE);
}
