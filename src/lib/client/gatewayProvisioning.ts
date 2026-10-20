import { Capacitor, registerPlugin } from '@capacitor/core';

export type GatewayWifiNetwork = {
  ssid: string;
  rssi: number;
  security: number;
};

type GatewayProvisioningPlugin = {
  scanNetworks(options: {
    serviceName: string;
    proofOfPossession: string;
  }): Promise<{ networks: GatewayWifiNetwork[] }>;
  provisionNetwork(options: { ssid: string; password: string }): Promise<{ connected: boolean }>;
  disconnect(): Promise<void>;
};

export const GatewayProvisioning = registerPlugin<GatewayProvisioningPlugin>('GatewayProvisioning');

export function isGatewayProvisioningAvailable() {
  return Capacitor.isNativePlatform() && ['android', 'ios'].includes(Capacitor.getPlatform());
}
