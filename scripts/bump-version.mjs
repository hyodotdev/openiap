#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const args = process.argv.slice(2);
const target = args[0]; // 'gql', 'docs', 'google', 'apple', or 'spec' (gql+docs together)
const bumpType = args[1]; // 'major', 'minor', 'patch', or specific version like '1.2.3'

if (!target || !bumpType) {
  console.error('Usage: bun scripts/bump-version.mjs <target> <type>');
  console.error('');
  console.error('Targets:');
  console.error('  spec     - Bump gql and docs together (they share version)');
  console.error('  gql      - Bump gql only');
  console.error('  docs     - Bump docs only');
  console.error('  google   - Bump google (Android) only');
  console.error('  apple    - Bump apple (iOS) only');
  console.error('');
  console.error('Types:');
  console.error('  major    - 1.0.0 → 2.0.0');
  console.error('  minor    - 1.0.0 → 1.1.0');
  console.error('  patch    - 1.0.0 → 1.0.1');
  console.error('  x.x.x    - Set specific version');
  console.error('');
  console.error('Examples:');
  console.error('  bun scripts/bump-version.mjs spec minor   # Bump spec version');
  console.error('  bun scripts/bump-version.mjs google patch # Bump google version');
  console.error('  bun scripts/bump-version.mjs apple 1.5.0  # Set apple version to 1.5.0');
  process.exit(1);
}

function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

function bumpVersion(version, type) {
  // If type is a version string (e.g., "1.2.3"), return it directly
  if (/^\d+\.\d+\.\d+$/.test(type)) {
    return type;
  }

  const { major, minor, patch } = parseVersion(version);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${type}`);
  }
}

// Read versions.json
const versionsPath = resolve(rootDir, 'versions.json');
const versions = JSON.parse(readFileSync(versionsPath, 'utf-8'));

console.log('📦 Bumping version...\n');
console.log('Current versions:');
console.log(`  gql:    ${versions.gql}`);
console.log(`  docs:   ${versions.docs}`);
console.log(`  google: ${versions.google}`);
console.log(`  apple:  ${versions.apple}`);
console.log('');

// Determine what to bump
const targets = target === 'spec' ? ['gql', 'docs'] : [target];

for (const t of targets) {
  if (!versions[t]) {
    console.error(`❌ Unknown target: ${t}`);
    process.exit(1);
  }

  const newVersion = bumpVersion(versions[t], bumpType);
  versions[t] = newVersion;
  console.log(`✅ ${t.padEnd(10)} ${versions[t]} → ${newVersion}`);
}

// Write updated versions
writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');

console.log('\n📝 Updated versions.json');
console.log('');

// Sync to package.json files
try {
  execSync('bun scripts/sync-versions.mjs', { cwd: rootDir, stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to sync versions to package.json files');
  process.exit(1);
}

// Update iOS OpenIapVersion.swift
if (targets.includes('apple')) {
  const iosVersionFile = resolve(rootDir, 'packages/ios/Sources/OpenIapVersion.swift');
  let iosVersionContent = readFileSync(iosVersionFile, 'utf-8');
  iosVersionContent = iosVersionContent.replace(
    /public static let current: String = "[\d.]+"/,
    `public static let current: String = "${versions.apple}"`
  );
  iosVersionContent = iosVersionContent.replace(
    /public static let gqlVersion: String = "[\d.]+"/,
    `public static let gqlVersion: String = "${versions.gql}"`
  );
  writeFileSync(iosVersionFile, iosVersionContent);
  console.log('✅ Updated iOS OpenIapVersion.swift');
}

// Android version is read from versions.json at build time, no update needed

console.log('\n💡 Next steps:');
console.log('  1. Review changes: git diff');
console.log('  2. Commit: git add . && git commit -m "chore: bump version to X.X.X"');
console.log('  3. Tag: git tag vX.X.X');
console.log('  4. Push: git push && git push --tags');
