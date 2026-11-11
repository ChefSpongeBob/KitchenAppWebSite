import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
const capacitorPath = path.join(root, 'capacitor.config.json');

let ok = true;

function pass(message) {
  console.log(`OK: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  ok = false;
}

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

const gradle = read(gradlePath);
if (!gradle) {
  fail('Missing android/app/build.gradle');
} else {
  const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/);
  const versionNameMatch = gradle.match(/versionName\s+"([^"]+)"/);
  if (versionCodeMatch) pass(`Android versionCode = ${versionCodeMatch[1]}`);
  else fail('Missing Android versionCode');

  if (versionNameMatch) pass(`Android versionName = ${versionNameMatch[1]}`);
  else fail('Missing Android versionName');

  if (/minifyEnabled\s+true/.test(gradle)) pass('Release minifyEnabled is true');
  else console.log('WARN: Release minifyEnabled is false (allowed, but less optimized).');

  if (gradle.includes('applicationId "com.nexusnorthsystems.crimini"')) pass('Android applicationId is final');
  else fail('Android applicationId should be com.nexusnorthsystems.crimini');

  if (gradle.includes('com.android.billingclient:billing')) pass('Google Play Billing dependency is present');
  else fail('Google Play Billing dependency is missing');
}

const capacitorRaw = read(capacitorPath);
if (!capacitorRaw) {
  fail('Missing capacitor.config.json');
} else {
  const config = JSON.parse(capacitorRaw);
  if (config?.android?.webContentsDebuggingEnabled === false) {
    pass('webContentsDebuggingEnabled is false');
  } else {
    fail('webContentsDebuggingEnabled should be false for release');
  }
}

const requiredEnv = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_ALIAS', 'ANDROID_KEYSTORE_PASSWORD'];
const signing = read(path.join(root, 'android', 'release-signing.gradle'));
if (gradle.includes("apply from: '../release-signing.gradle'") && signing.includes('verifyReleaseSigning')) {
  pass('Release signing is wired; store bundles require private signing material');
} else {
  fail('Release signing and the store-bundle signing guard must be wired');
}
const privateSigningFile = fs.existsSync(path.join(root, 'android', 'key.properties'));
for (const key of requiredEnv) {
  if ((process.env[key] ?? '').trim()) pass(`${key} is set`);
  else if (!privateSigningFile) console.log(`PENDING: ${key} or ignored android/key.properties is needed for store signing`);
}
if (process.argv.includes('--store')) {
  if (!privateSigningFile && requiredEnv.some(key => !process.env[key]?.trim())) {
    fail('Store release is not ready without configured signing. No key is generated automatically.');
  } else {
    const args = [':app:verifyReleaseSigning', '--offline', '--no-daemon', '--console=plain'];
    const result = spawnSync(process.platform === 'win32' ? 'cmd.exe' : './gradlew',
      process.platform === 'win32' ? ['/d', '/c', 'gradlew.bat', ...args] : args,
      { cwd: path.join(root, 'android'), stdio: 'inherit', windowsHide: true });
    if (result.error || result.status !== 0) fail('Gradle rejected release signing configuration.');
    else pass('Gradle accepted the private signing configuration; the signed artifact still needs verification.');
  }
}

if (!ok) {
  console.error('\nAndroid release pass failed.');
  process.exitCode = 1;
} else {
  console.log('\nAndroid configuration checks passed; this is not a signed-build or device-test approval.');
}
