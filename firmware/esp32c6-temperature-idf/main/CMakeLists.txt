set(srcs
  "crimini_packet.c"
  "crimini_radio.c"
)

if(CONFIG_CRIMINI_FIRMWARE_ROLE_SENSOR_NODE)
  list(APPEND srcs "crimini_sensor_node.c")
else()
  list(APPEND srcs "crimini_gateway.c")
endif()

idf_component_register(
  SRCS ${srcs}
  INCLUDE_DIRS "."
  REQUIRES
    driver
    esp_event
    esp_http_client
    esp_netif
    esp_timer
    esp_wifi
    ieee802154
    mbedtls
    nvs_flash
)
