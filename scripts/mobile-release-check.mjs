import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const capacitorPath = path.join(root, 'capacitor.config.json');
const infoPlistPath = path.join(root, 'ios', 'App', 'App', 'Info.plist');
const xcodeProjectPath = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  return false;
}

function pass(message) {
  console.log(`OK: ${message}`);
  return true;
}

let ok = true;

const capacitorRaw = readText(capacitorPath);
if (!capacitorRaw) {
  ok = fail('Missing capacitor.config.json') && ok;
} else {
  const config = JSON.parse(capacitorRaw);
  ok = (config.loggingBehavior === 'none'
    ? pass('Capacitor loggingBehavior is none')
    : fail(`Capacitor loggingBehavior should be "none" (found "${config.loggingBehavior}")`)) && ok;

  ok = (config?.android?.webContentsDebuggingEnabled === false
    ? pass('Android webContentsDebuggingEnabled is false')
    : fail('Android webContentsDebuggingEnabled should be false for release')) && ok;

  ok = (typeof config?.server?.url === 'string' && config.server.url.startsWith('https://')
    ? pass('Capacitor server.url uses https')
    : fail('Capacitor server.url should be a valid https URL')) && ok;
}

const infoPlist = readText(infoPlistPath);
if (!infoPlist) {
  ok = fail('Missing ios/App/App/Info.plist') && ok;
} else {
  ok = (infoPlist.includes('<key>CFBundleDisplayName</key>')
    ? pass('Info.plist has CFBundleDisplayName')
    : fail('Info.plist is missing CFBundleDisplayName')) && ok;
}

const xcodeProject = readText(xcodeProjectPath);
if (!xcodeProject) {
  ok = fail('Missing ios/App/App.xcodeproj/project.pbxproj') && ok;
} else {
  const hasMarketingVersion = /MARKETING_VERSION\s*=\s*[^;]+;/.test(xcodeProject);
  const hasBuildVersion = /CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/.test(xcodeProject);
  ok = (hasMarketingVersion ? pass('iOS MARKETING_VERSION is present') : fail('Missing iOS MARKETING_VERSION')) && ok;
  ok = (hasBuildVersion
    ? pass('iOS CURRENT_PROJECT_VERSION is present')
    : fail('Missing iOS CURRENT_PROJECT_VERSION')) && ok;
}

if (!ok) {
  process.exitCode = 1;
  console.error('\nMobile release check failed.');
} else {
  console.log('\nMobile release check passed.');
}

