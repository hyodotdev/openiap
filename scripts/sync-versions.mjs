#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Read versions.json
const versionsPath = resolve(rootDir, 'versions.json');
const versions = JSON.parse(readFileSync(versionsPath, 'utf-8'));

console.log('📦 Syncing versions across packages...\n');

// Update package.json files
const packages = [
  { name: 'gql', version: versions.spec },
  { name: 'docs', version: versions.spec },
  { name: 'google', version: versions.google },
  { name: 'apple', version: versions.apple },
];

for (const pkg of packages) {
  const pkgPath = resolve(rootDir, `packages/${pkg.name}/package.json`);

  try {
    const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pkgJson.version = pkg.version;
    writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
    console.log(`✅ ${pkg.name.padEnd(10)} → ${pkg.version}`);
  } catch (error) {
    console.warn(`⚠️  ${pkg.name.padEnd(10)} → package.json not found`);
  }
}

console.log('\n🎉 Version sync complete!\n');
console.log('Current versions:');
console.log(`  GQL & Docs: ${versions.spec} (spec versions)`);
console.log(`  Google:     ${versions.google} (Android implementation)`);
console.log(`  Apple:      ${versions.apple} (iOS implementation)`);
