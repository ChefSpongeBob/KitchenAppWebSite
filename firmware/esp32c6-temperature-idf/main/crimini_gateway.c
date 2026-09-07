#include <stdio.h>
#include <string.h>
#include <time.h>

#include "crimini_config_loader.h"
#include "crimini_packet.h"
#include "crimini_radio.h"
#include "esp_check.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_ieee802154.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_sntp.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "nvs_flash.h"

static const char* TAG = "crimini-gateway";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAILED_BIT BIT1
#define JSON_BODY_MAX 8192

typedef struct {
  uint8_t frame[CRIMINI_RADIO_FRAME_BUFFER_MAX];
  size_t frame_len;
  int8_t rssi;
  uint8_t lqi;
} radio_rx_event_t;

typedef struct {
  crimini_temp_payload_t payload;
  int8_t rssi;
  uint8_t lqi;
  int64_t received_at;
} queued_reading_t;

typedef struct {
  char serial[CRIMINI_SERIAL_SIZE];
  uint32_t sequence;
  uint32_t wake_nonce;
} seen_packet_t;

static QueueHandle_t s_radio_queue;
static EventGroupHandle_t s_wifi_events;
static int s_wifi_retry_count;
static queued_reading_t s_pending[CRIMINI_GATEWAY_QUEUE_DEPTH];
static size_t s_pending_count;
static seen_packet_t s_seen[CRIMINI_GATEWAY_QUEUE_DEPTH];
static size_t s_seen_cursor;

static const char* find_node_secret(const char* serial) {
  for (size_t i = 0; i < sizeof(CRIMINI_KNOWN_NODES) / sizeof(CRIMINI_KNOWN_NODES[0]); ++i) {
    if (strncmp(serial, CRIMINI_KNOWN_NODES[i].serial, CRIMINI_SERIAL_SIZE) == 0) {
      return CRIMINI_KNOWN_NODES[i].secret;
    }
  }
  return NULL;
}

static bool already_seen(const crimini_temp_payload_t* payload) {
  for (size_t i = 0; i < sizeof(s_seen) / sizeof(s_seen[0]); ++i) {
    if (
      s_seen[i].sequence == payload->sequence &&
      s_seen[i].wake_nonce == payload->wake_nonce &&
      strncmp(s_seen[i].serial, payload->node_serial, CRIMINI_SERIAL_SIZE) == 0
    ) {
      return true;
    }
  }

  seen_packet_t* slot = &s_seen[s_seen_cursor++ % (sizeof(s_seen) / sizeof(s_seen[0]))];
  memset(slot, 0, sizeof(*slot));
  strncpy(slot->serial, payload->node_serial, CRIMINI_SERIAL_SIZE - 1);
  slot->sequence = payload->sequence;
  slot->wake_nonce = payload->wake_nonce;
  return false;
}

static void wifi_event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) {
  (void)arg;
  (void)event_data;

  if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
    esp_wifi_connect();
  } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
    if (s_wifi_retry_count < 3) {
      s_wifi_retry_count += 1;
      esp_wifi_connect();
    } else {
      xEventGroupSetBits(s_wifi_events, WIFI_FAILED_BIT);
    }
  } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
    s_wifi_retry_count = 0;
    xEventGroupSetBits(s_wifi_events, WIFI_CONNECTED_BIT);
  }
}

static esp_err_t wifi_init_once(void) {
  static bool initialized = false;
  if (initialized) return ESP_OK;

  ESP_RETURN_ON_ERROR(esp_netif_init(), TAG, "netif init failed");
  ESP_RETURN_ON_ERROR(esp_event_loop_create_default(), TAG, "event loop init failed");
  esp_netif_create_default_wifi_sta();

  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  ESP_RETURN_ON_ERROR(esp_wifi_init(&cfg), TAG, "wifi init failed");
  ESP_RETURN_ON_ERROR(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL), TAG, "wifi handler failed");
  ESP_RETURN_ON_ERROR(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL), TAG, "ip handler failed");

  wifi_config_t wifi_config = {0};
  strncpy((char*)wifi_config.sta.ssid, CRIMINI_WIFI_SSID, sizeof(wifi_config.sta.ssid));
  strncpy((char*)wifi_config.sta.password, CRIMINI_WIFI_PASSWORD, sizeof(wifi_config.sta.password));
  wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

  ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_STA), TAG, "wifi mode failed");
  ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &wifi_config), TAG, "wifi config failed");
  initialized = true;
  return ESP_OK;
}

static esp_err_t wifi_connect_for_post(void) {
  s_wifi_retry_count = 0;
  xEventGroupClearBits(s_wifi_events, WIFI_CONNECTED_BIT | WIFI_FAILED_BIT);
  ESP_RETURN_ON_ERROR(wifi_init_once(), TAG, "wifi setup failed");
  ESP_RETURN_ON_ERROR(esp_wifi_start(), TAG, "wifi start failed");

  const EventBits_t bits = xEventGroupWaitBits(
    s_wifi_events,
    WIFI_CONNECTED_BIT | WIFI_FAILED_BIT,
    pdFALSE,
    pdFALSE,
    pdMS_TO_TICKS(CRIMINI_GATEWAY_WIFI_TIMEOUT_MS)
  );
  if (bits & WIFI_CONNECTED_BIT) return ESP_OK;
  return ESP_ERR_TIMEOUT;
}

static void wifi_stop_after_post(void) {
  esp_wifi_disconnect();
  esp_wifi_stop();
}

static void sync_time_if_needed(void) {
  time_t now = 0;
  time(&now);
  if (now > 1700000000) return;

  esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
  esp_sntp_setservername(0, "pool.ntp.org");
  esp_sntp_init();

  for (uint8_t i = 0; i < 20; ++i) {
    time(&now);
    if (now > 1700000000) break;
    vTaskDelay(pdMS_TO_TICKS(250));
  }
  esp_sntp_stop();
}

static int64_t reading_epoch_seconds(const queued_reading_t* reading) {
  time_t now = 0;
  time(&now);
  if (now > 1700000000) return (int64_t)now;
  return reading->received_at / 1000000LL;
}

static bool append_json_reading(char* body, size_t body_len, size_t* offset, const queued_reading_t* reading) {
  const float temperature = (float)reading->payload.temp_centi_f / 100.0f;
  const float humidity = (float)reading->payload.humidity_centi_pct / 100.0f;
  const int written = snprintf(
    body + *offset,
    body_len - *offset,
    "%s{\"node_serial\":\"%s\",\"temperature\":%.2f,\"humidity_pct\":%.2f,\"ts\":%lld,\"battery_mv\":%u,\"rssi\":%d,\"lqi\":%u,\"packet_sequence\":%lu,\"wake_nonce\":\"%08lx\"}",
    *offset > strlen("{\"readings\":[") ? "," : "",
    reading->payload.node_serial,
    temperature,
    humidity,
    (long long)reading_epoch_seconds(reading),
    reading->payload.battery_mv,
    reading->rssi,
    reading->lqi,
    (unsigned long)reading->payload.sequence,
    (unsigned long)reading->payload.wake_nonce
  );
  if (written < 0 || (size_t)written >= body_len - *offset) return false;
  *offset += (size_t)written;
  return true;
}

static bool build_json_body(char* body, size_t body_len) {
  size_t offset = 0;
  int written = snprintf(body, body_len, "{\"readings\":[");
  if (written < 0 || (size_t)written >= body_len) return false;
  offset = (size_t)written;

  for (size_t i = 0; i < s_pending_count; ++i) {
    if (!append_json_reading(body, body_len, &offset, &s_pending[i])) return false;
  }

  written = snprintf(body + offset, body_len - offset, "]}");
  return written >= 0 && (size_t)written < body_len - offset;
}

static esp_err_t post_pending_readings(void) {
  if (s_pending_count == 0) return ESP_OK;
  if (!CRIMINI_GATEWAY_DEVICE_KEY[0] || strcmp(CRIMINI_GATEWAY_DEVICE_KEY, "replace_from_factory_manifest") == 0) {
    ESP_LOGE(TAG, "gateway device key is not configured");
    return ESP_ERR_INVALID_STATE;
  }
#if !defined(CRIMINI_ALLOW_INSECURE_TLS_FOR_CONTROLLED_VALIDATION)
  if (!CRIMINI_TLS_ROOT_CA_PEM[0]) {
    ESP_LOGE(TAG, "TLS root CA is required for production gateway posts");
    return ESP_ERR_INVALID_STATE;
  }
#endif

  char body[JSON_BODY_MAX] = {0};
  char url[256] = {0};
  snprintf(url, sizeof(url), "%s/api/temps", CRIMINI_API_BASE_URL);
  if (!build_json_body(body, sizeof(body))) {
    ESP_LOGE(TAG, "too many readings for JSON body");
    return ESP_ERR_NO_MEM;
  }

  crimini_radio_stop();
  if (wifi_connect_for_post() != ESP_OK) {
    ESP_LOGW(TAG, "wifi unavailable, keeping %u readings queued", (unsigned)s_pending_count);
    crimini_radio_start_receive();
    return ESP_ERR_TIMEOUT;
  }
  sync_time_if_needed();

  esp_http_client_config_t config = {
    .url = url,
    .timeout_ms = 10000,
#if !defined(CRIMINI_ALLOW_INSECURE_TLS_FOR_CONTROLLED_VALIDATION)
    .cert_pem = CRIMINI_TLS_ROOT_CA_PEM,
#endif
  };
  esp_http_client_handle_t client = esp_http_client_init(&config);
  if (!client) {
    wifi_stop_after_post();
    crimini_radio_start_receive();
    return ESP_FAIL;
  }

  esp_http_client_set_method(client, HTTP_METHOD_POST);
  esp_http_client_set_header(client, "Content-Type", "application/json");
  esp_http_client_set_header(client, "x-device-id", CRIMINI_GATEWAY_SERIAL);
  esp_http_client_set_header(client, "x-device-key", CRIMINI_GATEWAY_DEVICE_KEY);
  if (CRIMINI_OPTIONAL_BUSINESS_ID[0]) {
    esp_http_client_set_header(client, "x-business-id", CRIMINI_OPTIONAL_BUSINESS_ID);
  }
  esp_http_client_set_post_field(client, body, strlen(body));

  const esp_err_t err = esp_http_client_perform(client);
  const int status = esp_http_client_get_status_code(client);
  esp_http_client_cleanup(client);
  wifi_stop_after_post();
  crimini_radio_start_receive();

  if (err == ESP_OK && (status == 200 || status == 201 || status == 202)) {
    ESP_LOGI(TAG, "posted %u readings status=%d", (unsigned)s_pending_count, status);
    s_pending_count = 0;
    return ESP_OK;
  }

  ESP_LOGW(TAG, "post failed err=%s status=%d", esp_err_to_name(err), status);
  return err == ESP_OK ? ESP_FAIL : err;
}

static void queue_payload(const crimini_temp_payload_t* payload, int8_t rssi, uint8_t lqi) {
  if (s_pending_count >= sizeof(s_pending) / sizeof(s_pending[0])) {
    ESP_LOGW(TAG, "queue full, dropping oldest reading");
    memmove(&s_pending[0], &s_pending[1], sizeof(s_pending[0]) * (s_pending_count - 1));
    s_pending_count -= 1;
  }

  queued_reading_t* slot = &s_pending[s_pending_count++];
  memset(slot, 0, sizeof(*slot));
  memcpy(&slot->payload, payload, sizeof(*payload));
  slot->rssi = rssi;
  slot->lqi = lqi;
  slot->received_at = esp_timer_get_time();
}

static void process_radio_event(const radio_rx_event_t* event) {
  const uint8_t* payload_bytes = NULL;
  size_t payload_len = 0;
  if (!crimini_radio_parse_data_frame(
        event->frame,
        event->frame_len,
        CRIMINI_RADIO_PAN_ID,
        CRIMINI_GATEWAY_SHORT_ADDR,
        &payload_bytes,
        &payload_len
      )) {
    return;
  }
  if (payload_len != sizeof(crimini_temp_payload_t)) return;

  crimini_temp_payload_t payload = {0};
  memcpy(&payload, payload_bytes, sizeof(payload));
  if (
    payload.magic != CRIMINI_PACKET_MAGIC ||
    payload.version != CRIMINI_PACKET_VERSION ||
    payload.packet_type != CRIMINI_PACKET_TYPE_TEMP
  ) {
    return;
  }

  const char* secret = find_node_secret(payload.node_serial);
  if (!secret || !crimini_packet_verify(&payload, secret)) {
    ESP_LOGW(TAG, "rejected unsigned or unknown node packet serial=%.31s", payload.node_serial);
    return;
  }
  payload.node_serial[CRIMINI_SERIAL_SIZE - 1] = '\0';
  if (already_seen(&payload)) {
    ESP_LOGI(TAG, "duplicate node burst ignored serial=%s seq=%lu", payload.node_serial, (unsigned long)payload.sequence);
    return;
  }

  queue_payload(&payload, event->rssi, event->lqi);
  ESP_LOGI(TAG, "queued serial=%s seq=%lu temp=%.2fF humidity=%.2f%% rssi=%d lqi=%u",
    payload.node_serial,
    (unsigned long)payload.sequence,
    (float)payload.temp_centi_f / 100.0f,
    (float)payload.humidity_centi_pct / 100.0f,
    event->rssi,
    event->lqi
  );
}

void IRAM_ATTR esp_ieee802154_receive_done(uint8_t* frame, esp_ieee802154_frame_info_t* frame_info) {
  radio_rx_event_t event = {0};
  if (frame && frame[0] <= CRIMINI_RADIO_FRAME_MAX) {
    const size_t copy_len = 1 + frame[0];
    memcpy(event.frame, frame, copy_len <= sizeof(event.frame) ? copy_len : sizeof(event.frame));
    event.frame_len = copy_len <= sizeof(event.frame) ? copy_len : sizeof(event.frame);
    event.rssi = frame_info ? frame_info->rssi : 0;
    event.lqi = frame_info ? frame_info->lqi : 0;
    BaseType_t task_woken = pdFALSE;
    if (s_radio_queue) xQueueSendFromISR(s_radio_queue, &event, &task_woken);
    if (task_woken) portYIELD_FROM_ISR();
  }
  esp_ieee802154_receive_handle_done(frame);
}

void app_main(void) {
  ESP_LOGI(TAG, "boot gateway=%s", CRIMINI_GATEWAY_SERIAL);
  esp_err_t nvs_status = nvs_flash_init();
  if (nvs_status == ESP_ERR_NVS_NO_FREE_PAGES || nvs_status == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    nvs_status = nvs_flash_init();
  }
  ESP_ERROR_CHECK(nvs_status);

  s_radio_queue = xQueueCreate(CRIMINI_GATEWAY_QUEUE_DEPTH, sizeof(radio_rx_event_t));
  s_wifi_events = xEventGroupCreate();
  ESP_ERROR_CHECK(crimini_radio_init(true, CRIMINI_GATEWAY_SHORT_ADDR));
  ESP_ERROR_CHECK(crimini_radio_start_receive());

  int64_t last_post_ms = 0;
  while (true) {
    radio_rx_event_t event = {0};
    if (xQueueReceive(s_radio_queue, &event, pdMS_TO_TICKS(250)) == pdTRUE) {
      process_radio_event(&event);
      crimini_radio_start_receive();
    }

    const int64_t now_ms = esp_timer_get_time() / 1000LL;
    if (
      s_pending_count >= CRIMINI_GATEWAY_QUEUE_DEPTH ||
      (s_pending_count > 0 && now_ms - last_post_ms >= CRIMINI_GATEWAY_POST_INTERVAL_MS)
    ) {
      post_pending_readings();
      last_post_ms = now_ms;
    }
  }
}
