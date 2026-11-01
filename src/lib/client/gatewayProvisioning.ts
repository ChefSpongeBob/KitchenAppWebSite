export type GatewaySetupProgress = {
  gatewayId: string;
  businessId: string;
  startedAt: number;
  step: 1 | 2 | 3;
};

const PROGRESS_KEY = 'crimini.gateway-wifi-setup';

export function readGatewaySetupProgress(): GatewaySetupProgress | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) ?? 'null');
    if (!value || typeof value.gatewayId !== 'string' || typeof value.businessId !== 'string' ||
        !Number.isSafeInteger(value.startedAt) || value.startedAt <= 0 ||
        ![1, 2, 3].includes(value.step) || value.startedAt > Date.now() / 1000 + 5 ||
        Date.now() / 1000 - value.startedAt > 86400) return null;
    return { gatewayId: value.gatewayId, businessId: value.businessId, startedAt: value.startedAt, step: value.step };
  } catch {
    return null;
  }
}

export function saveGatewaySetupProgress(value: GatewaySetupProgress | null) {
  try {
    if (value) sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({
      gatewayId: value.gatewayId,
      businessId: value.businessId,
      startedAt: value.startedAt,
      step: value.step
    }));
    else sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Setup also works when browser storage is unavailable.
  }
}
