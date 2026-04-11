import { env } from '$env/dynamic/public';

function isEnabled(value: string | undefined, defaultValue = false) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export const cameraBetaEnabled = isEnabled(env.PUBLIC_CAMERA_BETA_ENABLED, true);
