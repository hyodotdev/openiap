/**
 * Reads libraries-versions.jsonc and patches example dependencies accordingly.
 * - "local": use local monorepo source (default)
 * - "<version>": install published npm package at that version
 *
 * Run: node scripts/resolve-deps.js
 */
const fs = require('fs');
const path = require('path');

/** Strip // comments from JSONC content */
const parseJsonc = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));

const VERSIONS_PATH = path.resolve(__dirname, '../../../../libraries-versions.jsonc');
const PKG_PATH = path.resolve(__dirname, '../package.json');
const LIB_NAME = 'expo-iap';

function main() {
  if (!fs.existsSync(VERSIONS_PATH)) {
    console.log(`[resolve-deps] No libraries-versions.jsonc found, using local dev.`);
    return;
  }

  const versions = parseJsonc(fs.readFileSync(VERSIONS_PATH, 'utf8'));
  const version = versions[LIB_NAME];
  const isLocal = !version || version === 'local';

  console.log(`\n========================================`);
  console.log(`  ${LIB_NAME} : ${isLocal ? 'LOCAL (monorepo source)' : `PUBLISHED v${version}`}`);
  console.log(`========================================\n`);

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));

  let changed = false;

  if (isLocal) {
    // Ensure local dev setup
    if (pkg.dependencies?.[LIB_NAME]) {
      delete pkg.dependencies[LIB_NAME];
      changed = true;
    }
    if (!pkg.expo?.autolinking?.nativeModulesDir) {
      pkg.expo = pkg.expo || {};
      pkg.expo.autolinking = pkg.expo.autolinking || {};
      pkg.expo.autolinking.nativeModulesDir = '..';
      changed = true;
    }
  } else {
    // Published version: add as dependency and remove autolinking local path
    const currentDep = pkg.dependencies?.[LIB_NAME];
    if (currentDep !== version) {
      pkg.dependencies = pkg.dependencies || {};
      pkg.dependencies[LIB_NAME] = version;
      changed = true;
    }
    if (pkg.expo?.autolinking?.nativeModulesDir) {
      delete pkg.expo.autolinking.nativeModulesDir;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`[resolve-deps] ${LIB_NAME}: ${isLocal ? 'local' : version}`);
    // Signal that install is needed
    process.exit(2);
  }
}

main();
