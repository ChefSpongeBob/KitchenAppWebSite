import Capacitor
import ESPProvision
import Foundation

@objc(GatewayProvisioningPlugin)
public class GatewayProvisioningPlugin: CAPPlugin, CAPBridgedPlugin, ESPDeviceConnectionDelegate {
    public let identifier = "GatewayProvisioningPlugin"
    public let jsName = "GatewayProvisioning"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scanNetworks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "provisionNetwork", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]

    private var activeDevice: ESPDevice?
    private var proofOfPossession = ""

    @objc func scanNetworks(_ call: CAPPluginCall) {
        guard let serviceName = call.getString("serviceName")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !serviceName.isEmpty,
              let proof = call.getString("proofOfPossession")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !proof.isEmpty else {
            call.reject("Gateway setup details are missing.")
            return
        }

        activeDevice?.disconnect()
        activeDevice = nil
        proofOfPossession = proof

        ESPProvisionManager.shared.searchESPDevices(
            devicePrefix: serviceName,
            transport: .ble,
            security: .secure
        ) { [weak self] devices, error in
            guard let self else { return }
            guard error == nil,
                  let device = devices?.first(where: { $0.name == serviceName }) else {
                call.reject("Gateway was not found nearby.")
                return
            }

            self.activeDevice = device
            device.security = .secure
            device.proofOfPossession = proof
            device.connect(delegate: self) { status in
                switch status {
                case .connected:
                    self.scanGatewayNetworks(device: device, call: call)
                case .failedToConnect(let connectionError):
                    call.reject(connectionError.description)
                case .disconnected:
                    call.reject("Gateway disconnected during setup.")
                }
            }
        }
    }

    private func scanGatewayNetworks(device: ESPDevice, call: CAPPluginCall) {
        device.scanWifiList { networks, error in
            guard error == nil else {
                call.reject("Gateway could not scan Wi-Fi networks.")
                return
            }

            var seen = Set<String>()
            let result = (networks ?? [])
                .sorted { $0.rssi > $1.rssi }
                .compactMap { network -> [String: Any]? in
                    let ssid = network.ssid.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !ssid.isEmpty, seen.insert(ssid).inserted else { return nil }
                    return [
                        "ssid": ssid,
                        "rssi": network.rssi,
                        "security": network.auth.rawValue
                    ]
                }
            call.resolve(["networks": result])
        }
    }

    @objc func provisionNetwork(_ call: CAPPluginCall) {
        guard let device = activeDevice else {
            call.reject("Connect to the gateway first.")
            return
        }
        guard let ssid = call.getString("ssid")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !ssid.isEmpty else {
            call.reject("Choose or enter a Wi-Fi network.")
            return
        }
        let password = call.getString("password") ?? ""

        device.provision(ssid: ssid, passPhrase: password) { [weak self] status in
            switch status {
            case .success:
                call.resolve(["connected": true])
                device.disconnect()
                self?.activeDevice = nil
            case .failure(let error):
                call.reject(error.description)
            case .configApplied:
                break
            }
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        activeDevice?.disconnect()
        activeDevice = nil
        proofOfPossession = ""
        call.resolve()
    }

    public func getProofOfPossesion(forDevice: ESPDevice, completionHandler: @escaping (String) -> Void) {
        completionHandler(proofOfPossession)
    }

    public func getUsername(forDevice: ESPDevice, completionHandler: @escaping (String?) -> Void) {
        completionHandler(nil)
    }
}
