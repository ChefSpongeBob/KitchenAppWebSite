#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define CRIMINI_PACKET_MAGIC 0x4352
#define CRIMINI_PACKET_VERSION 3
#define CRIMINI_PACKET_TYPE_TEMP 1
#define CRIMINI_HMAC_SIZE 32
#define CRIMINI_SERIAL_SIZE 32

typedef struct __attribute__((packed)) {
  uint16_t magic;
  uint8_t version;
  uint8_t packet_type;
  uint32_t sequence;
  uint32_t wake_nonce;
  char node_serial[CRIMINI_SERIAL_SIZE];
  int32_t temp_centi_f;
  uint16_t humidity_centi_pct;
  uint16_t battery_mv;
  uint8_t reserved[8];
  uint8_t hmac[CRIMINI_HMAC_SIZE];
} crimini_temp_payload_t;

_Static_assert(sizeof(crimini_temp_payload_t) <= 104, "Crimini payload must fit one IEEE 802.15.4 frame");

void crimini_packet_copy_serial(char dest[CRIMINI_SERIAL_SIZE], const char* serial);
size_t crimini_packet_signed_length(void);
bool crimini_packet_sign(crimini_temp_payload_t* packet, const char* secret);
bool crimini_packet_verify(const crimini_temp_payload_t* packet, const char* secret);
