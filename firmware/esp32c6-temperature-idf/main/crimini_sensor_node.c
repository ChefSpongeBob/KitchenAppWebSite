#include <math.h>
#include <string.h>
#include <time.h>

#include "crimini_config_loader.h"
#include "crimini_packet.h"
#include "crimini_radio.h"
#include "driver/i2c.h"
#include "esp_check.h"
#include "esp_ieee802154.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_sleep.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

static const char* TAG = "crimini-node";
static RTC_DATA_ATTR uint32_t s_sequence = 0;
static SemaphoreHandle_t s_tx_done;

static esp_err_t i2c_init(void) {
  i2c_config_t config = {
    .mode = I2C_MODE_MASTER,
    .sda_io_num = CRIMINI_I2C_SDA_GPIO,
    .scl_io_num = CRIMINI_I2C_SCL_GPIO,
    .sda_pullup_en = GPIO_PULLUP_ENABLE,
    .scl_pullup_en = GPIO_PULLUP_ENABLE,
    .master.clk_speed = CRIMINI_I2C_CLOCK_HZ,
    .clk_flags = 0,
  };
  ESP_RETURN_ON_ERROR(i2c_param_config(CRIMINI_I2C_PORT, &config), TAG, "i2c config failed");
  return i2c_driver_install(CRIMINI_I2C_PORT, I2C_MODE_MASTER, 0, 0, 0);
}

static esp_err_t i2c_write(uint8_t addr, const uint8_t* data, size_t len) {
  return i2c_master_write_to_device(CRIMINI_I2C_PORT, addr, data, len, pdMS_TO_TICKS(200));
}

static esp_err_t i2c_read(uint8_t addr, uint8_t* data, size_t len) {
  return i2c_master_read_from_device(CRIMINI_I2C_PORT, addr, data, len, pdMS_TO_TICKS(200));
}

static esp_err_t i2c_write_read(uint8_t addr, const uint8_t* tx, size_t tx_len, uint8_t* rx, size_t rx_len) {
  return i2c_master_write_read_device(CRIMINI_I2C_PORT, addr, tx, tx_len, rx, rx_len, pdMS_TO_TICKS(200));
}

static esp_err_t bmp280_probe(void) {
  uint8_t reg = 0xd0;
  uint8_t id = 0;
  ESP_RETURN_ON_ERROR(i2c_write_read(CRIMINI_BMP280_ADDRESS, &reg, 1, &id, 1), TAG, "bmp280 id read failed");
  return id == 0x58 ? ESP_OK : ESP_ERR_NOT_FOUND;
}

static esp_err_t aht20_read(float* temp_f, float* humidity_pct) {
  const uint8_t init_cmd[] = {0xbe, 0x08, 0x00};
  const uint8_t measure_cmd[] = {0xac, 0x33, 0x00};
  uint8_t data[6] = {0};

  ESP_RETURN_ON_ERROR(i2c_write(CRIMINI_AHT20_ADDRESS, init_cmd, sizeof(init_cmd)), TAG, "aht20 init failed");
  vTaskDelay(pdMS_TO_TICKS(20));
  ESP_RETURN_ON_ERROR(i2c_write(CRIMINI_AHT20_ADDRESS, measure_cmd, sizeof(measure_cmd)), TAG, "aht20 measure failed");
  vTaskDelay(pdMS_TO_TICKS(85));
  ESP_RETURN_ON_ERROR(i2c_read(CRIMINI_AHT20_ADDRESS, data, sizeof(data)), TAG, "aht20 read failed");

  if (data[0] & 0x80) return ESP_ERR_INVALID_STATE;

  const uint32_t raw_humidity = ((uint32_t)data[1] << 12) | ((uint32_t)data[2] << 4) | ((uint32_t)data[3] >> 4);
  const uint32_t raw_temp = (((uint32_t)data[3] & 0x0f) << 16) | ((uint32_t)data[4] << 8) | data[5];
  const float temp_c = ((float)raw_temp / 1048576.0f) * 200.0f - 50.0f;

  *humidity_pct = ((float)raw_humidity / 1048576.0f) * 100.0f;
  *temp_f = temp_c * 9.0f / 5.0f + 32.0f;
  return ESP_OK;
}

static uint16_t read_battery_mv(void) {
#ifdef CRIMINI_BATTERY_MV_FIXED
  return CRIMINI_BATTERY_MV_FIXED;
#else
  return 0;
#endif
}

static uint16_t clamp_humidity_centi(float humidity_pct) {
  if (!isfinite(humidity_pct)) return 0;
  if (humidity_pct < 0.0f) return 0;
  if (humidity_pct > 100.0f) return 10000;
  return (uint16_t)lroundf(humidity_pct * 100.0f);
}

static void deep_sleep_next_cycle(void) {
  const uint32_t jitter = CRIMINI_SENSOR_WAKE_JITTER_SECONDS > 0
    ? esp_random() % (CRIMINI_SENSOR_WAKE_JITTER_SECONDS + 1)
    : 0;
  const uint64_t sleep_us = (uint64_t)(CRIMINI_SENSOR_WAKE_SECONDS + jitter) * 1000000ULL;
  ESP_LOGI(TAG, "sleeping for %lu seconds", (unsigned long)(sleep_us / 1000000ULL));
  esp_sleep_enable_timer_wakeup(sleep_us);
  esp_deep_sleep_start();
}

void IRAM_ATTR esp_ieee802154_transmit_done(const uint8_t* frame, const uint8_t* ack, esp_ieee802154_frame_info_t* ack_frame_info) {
  (void)frame;
  (void)ack;
  (void)ack_frame_info;
  BaseType_t task_woken = pdFALSE;
  if (s_tx_done) xSemaphoreGiveFromISR(s_tx_done, &task_woken);
  if (task_woken) portYIELD_FROM_ISR();
}

void IRAM_ATTR esp_ieee802154_transmit_failed(const uint8_t* frame, esp_ieee802154_tx_error_t error) {
  (void)frame;
  (void)error;
  BaseType_t task_woken = pdFALSE;
  if (s_tx_done) xSemaphoreGiveFromISR(s_tx_done, &task_woken);
  if (task_woken) portYIELD_FROM_ISR();
}

void app_main(void) {
  ESP_LOGI(TAG, "boot node=%s", CRIMINI_NODE_SERIAL);
  s_tx_done = xSemaphoreCreateBinary();

  if (i2c_init() != ESP_OK) {
    ESP_LOGE(TAG, "i2c unavailable");
    deep_sleep_next_cycle();
  }

  const esp_err_t bmp_status = bmp280_probe();
  ESP_LOGI(TAG, "bmp280 validation: %s", bmp_status == ESP_OK ? "ok" : "not detected");

  float temp_f = 0.0f;
  float humidity_pct = 0.0f;
  if (aht20_read(&temp_f, &humidity_pct) != ESP_OK) {
    ESP_LOGE(TAG, "aht20 unavailable");
    deep_sleep_next_cycle();
  }

  crimini_temp_payload_t payload = {
    .magic = CRIMINI_PACKET_MAGIC,
    .version = CRIMINI_PACKET_VERSION,
    .packet_type = CRIMINI_PACKET_TYPE_TEMP,
    .sequence = ++s_sequence,
    .wake_nonce = esp_random(),
    .temp_centi_f = (int32_t)lroundf(temp_f * 100.0f),
    .humidity_centi_pct = clamp_humidity_centi(humidity_pct),
    .battery_mv = read_battery_mv(),
  };
  crimini_packet_copy_serial(payload.node_serial, CRIMINI_NODE_SERIAL);

  if (!crimini_packet_sign(&payload, CRIMINI_NODE_SHARED_SECRET)) {
    ESP_LOGE(TAG, "packet signing failed");
    deep_sleep_next_cycle();
  }

  ESP_ERROR_CHECK(crimini_radio_init(false, CRIMINI_SENSOR_SHORT_ADDR));

  for (uint8_t burst = 0; burst < CRIMINI_SENSOR_BURST_COUNT; ++burst) {
    uint8_t frame[CRIMINI_RADIO_FRAME_BUFFER_MAX] = {0};
    size_t frame_len = 0;
    const esp_err_t built = crimini_radio_build_data_frame(
      frame,
      sizeof(frame),
      (uint8_t)(payload.sequence + burst),
      CRIMINI_RADIO_PAN_ID,
      CRIMINI_GATEWAY_SHORT_ADDR,
      CRIMINI_SENSOR_SHORT_ADDR,
      (const uint8_t*)&payload,
      sizeof(payload),
      &frame_len
    );
    if (built == ESP_OK) {
      xSemaphoreTake(s_tx_done, 0);
      const esp_err_t sent = esp_ieee802154_transmit(frame, true);
      ESP_LOGI(TAG, "burst %u sequence=%lu temp=%.2fF humidity=%.2f%% sent=%s", burst + 1, (unsigned long)payload.sequence, temp_f, humidity_pct, esp_err_to_name(sent));
      xSemaphoreTake(s_tx_done, pdMS_TO_TICKS(250));
    }
    vTaskDelay(pdMS_TO_TICKS(CRIMINI_SENSOR_BURST_SPACING_MS));
  }

  crimini_radio_stop();
  i2c_driver_delete(CRIMINI_I2C_PORT);
  deep_sleep_next_cycle();
}
