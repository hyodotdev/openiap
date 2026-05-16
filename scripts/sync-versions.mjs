#!/usr/bin/env bun
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Read OpenIAP package versions from the repository SSOT.
const versionsPath = resolve(rootDir, 'openiap-versions.json');
const versions = JSON.parse(readFileSync(versionsPath, 'utf-8'));

console.log('📦 Syncing OpenIAP versions from openiap-versions.json...\n');
execFileSync('./scripts/sync-versions.sh', { cwd: rootDir, stdio: 'inherit' });

console.log('\n🎉 Version sync complete!\n');
console.log('Current versions:');
console.log(`  GQL & Docs: ${versions.spec} (spec versions)`);
console.log(`  Google:     ${versions.google} (Android implementation)`);
console.log(`  Apple:      ${versions.apple} (iOS implementation)`);
