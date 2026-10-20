package com.nexusnorthsystems.crimini;

import android.Manifest;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.le.ScanResult;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.espressif.provisioning.DeviceConnectionEvent;
import com.espressif.provisioning.ESPConstants;
import com.espressif.provisioning.ESPDevice;
import com.espressif.provisioning.ESPProvisionManager;
import com.espressif.provisioning.WiFiAccessPoint;
import com.espressif.provisioning.listeners.BleScanListener;
import com.espressif.provisioning.listeners.ProvisionListener;
import com.espressif.provisioning.listeners.WiFiScanListener;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;

@CapacitorPlugin(
  name = "GatewayProvisioning",
  permissions = {
    @Permission(
      strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT },
      alias = GatewayProvisioningPlugin.BLUETOOTH_PERMISSION
    ),
    @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION }, alias = GatewayProvisioningPlugin.LOCATION_PERMISSION)
  }
)
public class GatewayProvisioningPlugin extends Plugin {
  static final String BLUETOOTH_PERMISSION = "bluetooth";
  static final String LOCATION_PERMISSION = "location";
  private static final long OPERATION_TIMEOUT_MS = 30000;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private ESPProvisionManager provisionManager;
  private ESPDevice activeDevice;
  private PluginCall pendingScanCall;
  private boolean connecting;

  private final Runnable timeoutTask = () -> failScan("Gateway setup timed out. Keep the phone near the powered gateway and try again.");

  @Override
  public void load() {
    provisionManager = ESPProvisionManager.getInstance(getContext());
    if (!EventBus.getDefault().isRegistered(this)) EventBus.getDefault().register(this);
  }

  @Override
  protected void handleOnDestroy() {
    handler.removeCallbacksAndMessages(null);
    disconnectDevice();
    if (EventBus.getDefault().isRegistered(this)) EventBus.getDefault().unregister(this);
  }

  @PluginMethod
  public void scanNetworks(PluginCall call) {
    String serviceName = call.getString("serviceName", "").trim();
    String proof = call.getString("proofOfPossession", "").trim();
    if (serviceName.isEmpty() || proof.isEmpty()) {
      call.reject("Gateway setup details are missing.");
      return;
    }

    String alias = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? BLUETOOTH_PERMISSION : LOCATION_PERMISSION;
    if (getPermissionState(alias) != PermissionState.GRANTED) {
      requestPermissionForAlias(alias, call, "permissionCallback");
      return;
    }
    beginScan(call, serviceName, proof);
  }

  @PermissionCallback
  private void permissionCallback(PluginCall call) {
    String alias = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? BLUETOOTH_PERMISSION : LOCATION_PERMISSION;
    if (getPermissionState(alias) != PermissionState.GRANTED) {
      call.reject("Bluetooth permission is required to connect the gateway.");
      return;
    }
    beginScan(
      call,
      call.getString("serviceName", "").trim(),
      call.getString("proofOfPossession", "").trim()
    );
  }

  private void beginScan(PluginCall call, String serviceName, String proof) {
    disconnectDevice();
    pendingScanCall = call;
    connecting = false;
    handler.removeCallbacks(timeoutTask);
    handler.postDelayed(timeoutTask, OPERATION_TIMEOUT_MS);

    provisionManager.searchBleEspDevices(serviceName, new BleScanListener() {
      @Override
      public void scanStartFailed() {
        failScan("Turn on Bluetooth to connect the gateway.");
      }

      @Override
      public void onPeripheralFound(BluetoothDevice device, ScanResult scanResult) {
        if (pendingScanCall == null || connecting || scanResult.getScanRecord() == null) return;
        String foundName = scanResult.getScanRecord().getDeviceName();
        if (!serviceName.equals(foundName)) return;
        if (scanResult.getScanRecord().getServiceUuids() == null || scanResult.getScanRecord().getServiceUuids().isEmpty()) {
          failScan("Gateway Bluetooth service is unavailable.");
          return;
        }

        connecting = true;
        provisionManager.stopBleScan();
        activeDevice = provisionManager.createESPDevice(
          ESPConstants.TransportType.TRANSPORT_BLE,
          ESPConstants.SecurityType.SECURITY_1
        );
        activeDevice.setProofOfPossession(proof);
        activeDevice.connectBLEDevice(device, scanResult.getScanRecord().getServiceUuids().get(0).toString());
      }

      @Override
      public void scanCompleted() {
        if (!connecting) failScan("Gateway was not found nearby.");
      }

      @Override
      public void onFailure(Exception error) {
        failScan(safeMessage(error, "Gateway scan failed."));
      }
    });
  }

  @Subscribe(threadMode = ThreadMode.MAIN)
  public void onDeviceConnectionEvent(DeviceConnectionEvent event) {
    if (pendingScanCall == null) return;
    if (event.getEventType() == ESPConstants.EVENT_DEVICE_CONNECTED) {
      scanGatewayNetworks();
    } else if (event.getEventType() == ESPConstants.EVENT_DEVICE_CONNECTION_FAILED) {
      failScan("Could not connect to the gateway.");
    } else if (event.getEventType() == ESPConstants.EVENT_DEVICE_DISCONNECTED) {
      failScan("Gateway disconnected during setup.");
    }
  }

  private void scanGatewayNetworks() {
    if (activeDevice == null) {
      failScan("Gateway connection is unavailable.");
      return;
    }
    activeDevice.scanNetworks(new WiFiScanListener() {
      @Override
      public void onWifiListReceived(ArrayList<WiFiAccessPoint> wifiList) {
        PluginCall call = pendingScanCall;
        pendingScanCall = null;
        connecting = false;
        handler.removeCallbacks(timeoutTask);
        if (call == null) return;

        wifiList.sort(Comparator.comparingInt(WiFiAccessPoint::getRssi).reversed());
        Set<String> seen = new HashSet<>();
        JSArray networks = new JSArray();
        for (WiFiAccessPoint network : wifiList) {
          String ssid = network.getWifiName() == null ? "" : network.getWifiName().trim();
          if (ssid.isEmpty() || !seen.add(ssid)) continue;
          JSObject item = new JSObject();
          item.put("ssid", ssid);
          item.put("rssi", network.getRssi());
          item.put("security", network.getSecurity());
          networks.put(item);
        }
        JSObject result = new JSObject();
        result.put("networks", networks);
        call.resolve(result);
      }

      @Override
      public void onWiFiScanFailed(Exception error) {
        failScan(safeMessage(error, "Gateway could not scan Wi-Fi networks."));
      }
    });
  }

  @PluginMethod
  public void provisionNetwork(PluginCall call) {
    String ssid = call.getString("ssid", "").trim();
    String password = call.getString("password", "");
    if (activeDevice == null) {
      call.reject("Connect to the gateway first.");
      return;
    }
    if (ssid.isEmpty()) {
      call.reject("Choose or enter a Wi-Fi network.");
      return;
    }

    handler.postDelayed(() -> {
      if (!call.isReleased()) call.reject("Gateway Wi-Fi connection timed out.");
    }, OPERATION_TIMEOUT_MS);

    activeDevice.provision(ssid, password, new ProvisionListener() {
      private boolean finished;

      private void rejectOnce(String message) {
        if (finished) return;
        finished = true;
        call.reject(message);
      }

      @Override public void createSessionFailed(Exception error) { rejectOnce(safeMessage(error, "Secure gateway session failed.")); }
      @Override public void wifiConfigSent() {}
      @Override public void wifiConfigFailed(Exception error) { rejectOnce(safeMessage(error, "Wi-Fi details could not be sent.")); }
      @Override public void wifiConfigApplied() {}
      @Override public void wifiConfigApplyFailed(Exception error) { rejectOnce(safeMessage(error, "Gateway could not apply Wi-Fi details.")); }
      @Override public void provisioningFailedFromDevice(ESPConstants.ProvisionFailureReason reason) { rejectOnce("Gateway could not join that Wi-Fi network."); }
      @Override public void onProvisioningFailed(Exception error) { rejectOnce(safeMessage(error, "Gateway Wi-Fi setup failed.")); }

      @Override
      public void deviceProvisioningSuccess() {
        if (finished) return;
        finished = true;
        JSObject result = new JSObject();
        result.put("connected", true);
        call.resolve(result);
        disconnectDevice();
      }
    });
  }

  @PluginMethod
  public void disconnect(PluginCall call) {
    handler.removeCallbacksAndMessages(null);
    disconnectDevice();
    call.resolve();
  }

  private void failScan(String message) {
    PluginCall call = pendingScanCall;
    pendingScanCall = null;
    connecting = false;
    handler.removeCallbacks(timeoutTask);
    if (provisionManager != null) provisionManager.stopBleScan();
    disconnectDevice();
    if (call != null) call.reject(message);
  }

  private void disconnectDevice() {
    if (activeDevice != null) activeDevice.disconnectDevice();
    activeDevice = null;
  }

  private String safeMessage(Exception error, String fallback) {
    if (error == null || error.getMessage() == null || error.getMessage().trim().isEmpty()) return fallback;
    return error.getMessage();
  }
}
