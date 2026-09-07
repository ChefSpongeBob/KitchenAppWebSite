#include "crimini_radio.h"

#include <string.h>

#include "crimini_config_loader.h"
#include "esp_check.h"
#include "esp_ieee802154.h"

#define DATA_FCF 0x8841

esp_err_t crimini_radio_init(bool coordinator, uint16_t short_address) {
  ESP_RETURN_ON_FALSE(CRIMINI_RADIO_CHANNEL >= 11 && CRIMINI_RADIO_CHANNEL <= 26, ESP_ERR_INVALID_ARG, "radio", "invalid channel");

  ESP_RETURN_ON_ERROR(esp_ieee802154_enable(), "radio", "enable failed");
  ESP_RETURN_ON_ERROR(esp_ieee802154_set_channel(CRIMINI_RADIO_CHANNEL), "radio", "set channel failed");
  ESP_RETURN_ON_ERROR(esp_ieee802154_set_txpower(CRIMINI_RADIO_TX_POWER_DBM), "radio", "set tx power failed");
  ESP_RETURN_ON_ERROR(esp_ieee802154_set_panid(CRIMINI_RADIO_PAN_ID), "radio", "set pan id failed");
  ESP_RETURN_ON_ERROR(esp_ieee802154_set_short_address(short_address), "radio", "set short address failed");
  ESP_RETURN_ON_ERROR(esp_ieee802154_set_promiscuous(false), "radio", "set promiscuous failed");
  ESP_RETURN_ON_ERROR(esp_ieee802154_set_coordinator(coordinator), "radio", "set coordinator failed");
  ESP_RETURN_ON_ERROR(esp_ieee802154_set_rx_when_idle(coordinator), "radio", "set rx idle failed");
  return ESP_OK;
}

esp_err_t crimini_radio_start_receive(void) {
  return esp_ieee802154_receive();
}

esp_err_t crimini_radio_stop(void) {
  return esp_ieee802154_sleep();
}

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
) {
  if (!frame || !payload || !out_frame_len) return ESP_ERR_INVALID_ARG;
  const size_t phy_len = CRIMINI_RADIO_MHR_LEN + payload_len + CRIMINI_RADIO_FCS_LEN;
  const size_t stored_len = 1 + CRIMINI_RADIO_MHR_LEN + payload_len;
  if (phy_len > CRIMINI_RADIO_FRAME_MAX || stored_len > frame_capacity) return ESP_ERR_INVALID_SIZE;

  memset(frame, 0, stored_len);
  frame[0] = (uint8_t)phy_len;
  frame[1] = DATA_FCF & 0xff;
  frame[2] = (DATA_FCF >> 8) & 0xff;
  frame[3] = sequence;
  frame[4] = pan_id & 0xff;
  frame[5] = (pan_id >> 8) & 0xff;
  frame[6] = dest_short & 0xff;
  frame[7] = (dest_short >> 8) & 0xff;
  frame[8] = src_short & 0xff;
  frame[9] = (src_short >> 8) & 0xff;
  memcpy(&frame[1 + CRIMINI_RADIO_MHR_LEN], payload, payload_len);
  *out_frame_len = stored_len;
  return ESP_OK;
}

bool crimini_radio_parse_data_frame(
  const uint8_t* frame,
  size_t frame_len,
  uint16_t expected_pan_id,
  uint16_t expected_dest_short,
  const uint8_t** out_payload,
  size_t* out_payload_len
) {
  if (!frame || !out_payload || !out_payload_len || frame_len < 1 + CRIMINI_RADIO_MHR_LEN) return false;
  const size_t phy_len = frame[0];
  if (phy_len < CRIMINI_RADIO_MHR_LEN + CRIMINI_RADIO_FCS_LEN) return false;
  if (frame_len < 1 + phy_len - CRIMINI_RADIO_FCS_LEN) return false;

  const uint16_t fcf = (uint16_t)frame[1] | ((uint16_t)frame[2] << 8);
  const uint16_t pan_id = (uint16_t)frame[4] | ((uint16_t)frame[5] << 8);
  const uint16_t dest_short = (uint16_t)frame[6] | ((uint16_t)frame[7] << 8);
  if (fcf != DATA_FCF || pan_id != expected_pan_id || dest_short != expected_dest_short) return false;

  *out_payload = &frame[1 + CRIMINI_RADIO_MHR_LEN];
  *out_payload_len = phy_len - CRIMINI_RADIO_MHR_LEN - CRIMINI_RADIO_FCS_LEN;
  return true;
}
