#include "crimini_packet.h"

#include <mbedtls/md.h>
#include <string.h>

void crimini_packet_copy_serial(char dest[CRIMINI_SERIAL_SIZE], const char* serial) {
  memset(dest, 0, CRIMINI_SERIAL_SIZE);
  if (!serial) return;
  strncpy(dest, serial, CRIMINI_SERIAL_SIZE - 1);
}

size_t crimini_packet_signed_length(void) {
  return offsetof(crimini_temp_payload_t, hmac);
}

static bool compute_hmac(const uint8_t* data, size_t length, const char* secret, uint8_t out[CRIMINI_HMAC_SIZE]) {
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!info || !secret || !secret[0]) return false;
  return mbedtls_md_hmac(info, (const uint8_t*)secret, strlen(secret), data, length, out) == 0;
}

static bool timing_safe_equal(const uint8_t* a, const uint8_t* b, size_t length) {
  uint8_t diff = 0;
  for (size_t i = 0; i < length; ++i) diff |= a[i] ^ b[i];
  return diff == 0;
}

bool crimini_packet_sign(crimini_temp_payload_t* packet, const char* secret) {
  if (!packet) return false;
  memset(packet->hmac, 0, CRIMINI_HMAC_SIZE);
  return compute_hmac((const uint8_t*)packet, crimini_packet_signed_length(), secret, packet->hmac);
}

bool crimini_packet_verify(const crimini_temp_payload_t* packet, const char* secret) {
  if (!packet) return false;
  uint8_t expected[CRIMINI_HMAC_SIZE] = {0};
  if (!compute_hmac((const uint8_t*)packet, crimini_packet_signed_length(), secret, expected)) return false;
  return timing_safe_equal(expected, packet->hmac, CRIMINI_HMAC_SIZE);
}
