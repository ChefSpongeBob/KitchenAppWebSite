import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

let registrationStarted = false;

function nativePlatform() {
  if (!browser) return 'unknown';
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'unknown';
}

async function postJson(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return response.ok;
}

export async function registerNativePushNotifications() {
  if (!browser || registrationStarted) return;
  const platform = nativePlatform();
  if (platform === 'unknown') return;

  registrationStarted = true;
  const currentPermission = await PushNotifications.checkPermissions();
  const permission =
    currentPermission.receive === 'granted'
      ? currentPermission
      : await PushNotifications.requestPermissions();

  if (permission.receive !== 'granted') {
    registrationStarted = false;
    return;
  }

  await PushNotifications.addListener('registration', async (token) => {
    await postJson('/api/push/register', {
      token: token.value,
      platform,
      appVersion: document.documentElement.dataset.appVersion ?? ''
    });
  });

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration failed:', error);
    registrationStarted = false;
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    // Deep-link routing will be added once APNs/FCM payloads are finalized.
  });

  await PushNotifications.register();
}

export async function revokeNativePushNotifications() {
  if (!browser) return false;
  registrationStarted = false;
  return postJson('/api/push/revoke', {});
}
