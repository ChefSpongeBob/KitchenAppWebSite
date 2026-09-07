#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

#define CRIMINI_RADIO_FRAME_MAX 127
#define CRIMINI_RADIO_FRAME_BUFFER_MAX 128
#define CRIMINI_RADIO_MHR_LEN 9
#define CRIMINI_RADIO_FCS_LEN 2

esp_err_t crimini_radio_init(bool coordinator, uint16_t short_address);
esp_err_t crimini_radio_start_receive(void);
esp_err_t crimini_radio_stop(void);
esp_err_t crimini_radio_build_data_frame(
  uint8_t* frame,
  size_t frame_capacity,
  uint8_t sequence,
  uint16_t pan_id,
  uint16_t dest_short,
  uint16_t src_short,
  const uint8_t* payload,
  size_t payload_len,
  size_t* out_frame_len
);
bool crimini_radio_parse_data_frame(
  const uint8_t* frame,
  size_t frame_len,
  uint16_t expected_pan_id,
  uint16_t expected_dest_short,
  const uint8_t** out_payload,
  size_t* out_payload_len
);
