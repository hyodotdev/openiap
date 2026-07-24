#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { updateNativeVersion } from './release-branch-policy.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const args = process.argv.slice(2);
const target = args[0]; // 'google' or 'apple'
const bumpType = args[1]; // 'major', 'minor', 'patch', or specific version like '1.2.3'

if (!target || !bumpType) {
  console.error('Usage: bun scripts/bump-version.mjs <target> <type>');
  console.error('');
  console.error('Targets:');
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
  console.error('  bun scripts/bump-version.mjs google patch # Bump google version');
  console.error('  bun scripts/bump-version.mjs apple 1.5.0  # Set apple version to 1.5.0');
  process.exit(1);
}

if (target !== 'google' && target !== 'apple') {
  console.error(
    `❌ Unknown target: ${target}. The spec is derived from the lower native version and cannot be bumped independently.`,
  );
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

// Read OpenIAP package versions from the repository SSOT.
const versionsPath = resolve(rootDir, 'openiap-versions.json');
const versions = JSON.parse(readFileSync(versionsPath, 'utf-8'));

console.log('📦 Bumping version...\n');
console.log('Current versions:');
console.log(`  spec:   ${versions.spec}`);
console.log(`  google: ${versions.google}`);
console.log(`  apple:  ${versions.apple}`);
console.log('');

const currentVersion = versions[target];
const newVersion = bumpVersion(currentVersion, bumpType);
const bumpedVersions = updateNativeVersion(target, newVersion, rootDir);
console.log(`✅ ${target.padEnd(10)} ${currentVersion} → ${newVersion}`);
console.log(`✅ ${'spec'.padEnd(10)} derived → ${bumpedVersions.spec}`);

console.log('\n📝 Updated openiap-versions.json');
console.log('');

// Sync to package.json files
try {
  execSync('bun scripts/sync-versions.mjs', { cwd: rootDir, stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to sync versions to package.json files');
  process.exit(1);
}

// Native runtime versions read openiap-versions.json at build/runtime.

const releaseTag =
  target === 'apple'
    ? bumpedVersions.apple
    : `google-${bumpedVersions.google}`;

console.log('\n💡 Next steps:');
console.log('  1. Review changes: git diff');
console.log('  2. Commit: git add . && git commit -m "chore(version): bump <target> to X.X.X"');
console.log(`  3. Tag: git tag ${releaseTag}`);
console.log('  4. Push: git push && git push --tags');
