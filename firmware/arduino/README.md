# Crimini temperature firmware

The firmware is two normal Arduino IDE sketches:

- `CriminiTempNode/CriminiTempNode.ino`: set `NODE_SERIAL` and the factory `RADIO_SECRET`, then upload it to each sensor.
- `CriminiTempGateway/CriminiTempGateway.ino`: set `GATEWAY_SERIAL`, the same `RADIO_SECRET`, Wi-Fi, and its separate factory-installed cloud credential, then upload it to the gateway.

Select **ESP32C6 Dev Module** for the TNY sensor nodes and **XIAO_ESP32C6** for the Seeed Studio XIAO gateway in Espressif's Arduino ESP32 package. Fit the gateway's 2.4 GHz external antenna before powering it; the gateway sketch selects the external connector using the XIAO RF switch (GPIO3 low, GPIO14 high). The node uses SDA GPIO18 and SCL GPIO19, reads temperature and humidity from the AHT20, sends three short IEEE 802.15.4 bursts, and deep-sleeps for five minutes plus a small random delay. Pressure is not used. Use a distinct, unpredictable radio secret for each gateway kit (at least 16 characters); flash it into that gateway and only its nodes. Customers never enter this value. A short HMAC tag authenticates each radio reading; readings are not encrypted over the air. The node reserves sequence numbers in flash once per 256 readings so its counter survives battery changes. The gateway drops recent repeats, and the API rejects readings older than the node's last accepted sequence.

Use lowercase serials with letters, numbers, hyphens, or underscores, up to 31 characters. The node derives its radio address from that serial, so no separate node address needs to be configured. At the factory, put the gateway's assigned cloud credential in the gateway sketch, then provision the same serial and credential hash in D1:

```powershell
$env:CRIMINI_GATEWAY_CREDENTIAL="the-same-32-plus-character-value-flashed-into-the-gateway"
npm run ops:provision-temp-gateway -- --remote --serial=gateway-0001 --confirm=provision-temperature-gateway
Remove-Item Env:CRIMINI_GATEWAY_CREDENTIAL
```

Customers register only the gateway serial in Crimini, then each node serial under that gateway. The provisioning command does not generate credentials and sends only the SHA-256 hash to D1. Never commit either filled-in secret to the repository. A stolen radio secret allows forging readings for its kit until devices are reflashed; it does not grant cloud API access.

Before shipping, test range, missed bursts, Wi-Fi/802.15.4 coexistence, outage recovery, and AA battery life on the actual boards. The gateway queue is RAM only, so a long outage or power loss can lose unsent readings. Do not erase a node's flash during updates: that resets its sequence and requires an intentional re-provisioning path. Factory firmware also needs a production plan for ESP32-C6 Secure Boot and flash encryption before secrets are placed on field devices.
