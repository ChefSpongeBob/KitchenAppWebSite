import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];

function read(relativePath) {
	const absolute = path.join(root, relativePath);
	return existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
}

function pass(label) {
	checks.push({ level: 'PASS', label });
}

function fail(label, detail = '') {
	checks.push({ level: 'FAIL', label, detail });
}

function warn(label, detail = '') {
	checks.push({ level: 'WARN', label, detail });
}

const capacitor = read('capacitor.config.json');
if (!capacitor) {
	fail('capacitor.config.json exists');
} else {
	const config = JSON.parse(capacitor);
	config.appId === 'com.nexusnorthsystems.crimini'
		? pass('Capacitor app id is final')
		: fail('Capacitor app id is final', `Found ${config.appId}`);
	config.appName === 'Crimini'
		? pass('Capacitor app name is Crimini')
		: fail('Capacitor app name is Crimini', `Found ${config.appName}`);
	config.server?.url === 'https://criminiops.com'
		? pass('Native shell points to production domain')
		: fail('Native shell points to production domain', `Found ${config.server?.url ?? 'missing'}`);
	config.android?.webContentsDebuggingEnabled === false
		? pass('Android WebView debugging is disabled')
		: fail('Android WebView debugging is disabled');
}

const androidGradle = read('android/app/build.gradle');
if (!androidGradle) {
	fail('Android Gradle app file exists');
} else {
	androidGradle.includes('applicationId "com.nexusnorthsystems.crimini"')
		? pass('Android applicationId is final')
		: fail('Android applicationId is final');
	androidGradle.includes('namespace = "com.nexusnorthsystems.crimini"')
		? pass('Android namespace is final')
		: fail('Android namespace is final');
	androidGradle.includes('com.android.billingclient:billing')
		? pass('Google Play Billing dependency is present')
		: fail('Google Play Billing dependency is present');
	/minifyEnabled\s+true/.test(androidGradle)
		? pass('Android release minification is enabled')
		: warn('Android release minification is disabled', 'Allowed, but enable before final Play release if possible.');
}

const androidManifest = read('android/app/src/main/AndroidManifest.xml');
androidManifest.includes('android:usesCleartextTraffic="false"')
	? pass('Android cleartext traffic is disabled')
	: fail('Android cleartext traffic is disabled');
androidManifest.includes('android:allowBackup="false"')
	? pass('Android app backup is disabled')
	: fail('Android app backup is disabled');

const xcodeProject = read('ios/App/App.xcodeproj/project.pbxproj');
if (!xcodeProject) {
	fail('iOS Xcode project exists');
} else {
	xcodeProject.includes('PRODUCT_BUNDLE_IDENTIFIER = com.nexusnorthsystems.crimini')
		? pass('iOS bundle identifier is final')
		: fail('iOS bundle identifier is final');
	/MARKETING_VERSION\s*=\s*[^;]+;/.test(xcodeProject)
		? pass('iOS marketing version is set')
		: fail('iOS marketing version is set');
	/CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/.test(xcodeProject)
		? pass('iOS build version is set')
		: fail('iOS build version is set');
}

const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
java.status === 0 || java.stderr
	? pass('Java/JDK command is available')
	: warn('Java/JDK command is not available', 'Set JAVA_HOME before building Android release bundles.');

for (const key of ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_ALIAS', 'ANDROID_KEYSTORE_PASSWORD']) {
	(process.env[key] ?? '').trim()
		? pass(`${key} is set`)
		: warn(`${key} is not set`, 'Needed for signed Android release builds.');
}

const failed = checks.filter((check) => check.level === 'FAIL');
for (const check of checks) {
	console.log(`${check.level} ${check.label}`);
	if (check.detail) console.log(`  ${check.detail}`);
}

if (failed.length) process.exit(1);
