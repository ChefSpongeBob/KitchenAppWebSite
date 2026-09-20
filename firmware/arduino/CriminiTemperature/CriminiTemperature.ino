#include <Arduino.h>

#include "CriminiLocalConfig.h"
#include "CriminiProtocol.h"

#if CRIMINI_ROLE_GATEWAY
#include "CriminiGateway.h"
#else
#include "CriminiSensorNode.h"
#endif

void setup() {
  Serial.begin(115200);
  delay(150);
#if CRIMINI_ROLE_GATEWAY
  criminiGatewaySetup();
#else
  criminiSensorSetup();
#endif
}

void loop() {
#if CRIMINI_ROLE_GATEWAY
  criminiGatewayLoop();
#else
  // The sensor enters deep sleep from setup().
  delay(1000);
#endif
}
