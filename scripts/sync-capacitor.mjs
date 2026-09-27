import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const capacitorCli = resolve('node_modules/@capacitor/cli/bin/capacitor');
const result = spawnSync(process.execPath, [capacitorCli, 'sync', ...process.argv.slice(2)], {
	cwd: process.cwd(),
	stdio: 'inherit'
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Capacitor can emit Windows separators into this Swift package path. SwiftPM
// resolves the project on macOS, so keep generated local package paths portable.
const swiftPackagePath = resolve('ios/App/CapApp-SPM/Package.swift');
if (existsSync(swiftPackagePath)) {
	const source = readFileSync(swiftPackagePath, 'utf8');
	const normalized = source.replace(/path: "([^"]+)"/g, (_, dependencyPath) =>
		`path: "${dependencyPath.replaceAll('\\', '/')}"`
	);

	if (normalized !== source) {
		writeFileSync(swiftPackagePath, normalized, 'utf8');
		console.log('Normalized SwiftPM local dependency paths.');
	}
}
