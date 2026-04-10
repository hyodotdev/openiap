/**
 * Reads libraries-versions.jsonc and patches example + root dependencies.
 * - "local": use yarn workspace + monorepo source (default)
 * - "<version>": install published npm package, disable workspace
 *
 * Run: node scripts/resolve-deps.js
 */
const fs = require('fs');
const path = require('path');

/** Strip // comments from JSONC content */
const parseJsonc = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));

const VERSIONS_PATH = path.resolve(__dirname, '../../../../libraries-versions.jsonc');
const EXAMPLE_PKG_PATH = path.resolve(__dirname, '../package.json');
const ROOT_PKG_PATH = path.resolve(__dirname, '../../package.json');
const LIB_NAME = 'react-native-iap';

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

  let changed = false;

  const EXAMPLE_LOCKFILE = path.resolve(__dirname, '../yarn.lock');

  if (isLocal) {
    // 1. Ensure example is in workspace
    const rootPkg = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, 'utf8'));
    if (!rootPkg.workspaces?.includes('example')) {
      rootPkg.workspaces = ['example'];
      fs.writeFileSync(ROOT_PKG_PATH, JSON.stringify(rootPkg, null, 2) + '\n');
      changed = true;
    }

    // 2. Remove published dep from example
    const pkg = JSON.parse(fs.readFileSync(EXAMPLE_PKG_PATH, 'utf8'));
    if (pkg.dependencies?.[LIB_NAME]) {
      delete pkg.dependencies[LIB_NAME];
      fs.writeFileSync(EXAMPLE_PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
      changed = true;
    }

    // 3. Remove standalone lockfile (rejoin workspace)
    if (fs.existsSync(EXAMPLE_LOCKFILE)) {
      fs.unlinkSync(EXAMPLE_LOCKFILE);
      changed = true;
    }
  } else {
    // 1. Remove example from workspace
    const rootPkg = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, 'utf8'));
    if (rootPkg.workspaces?.length > 0) {
      rootPkg.workspaces = [];
      fs.writeFileSync(ROOT_PKG_PATH, JSON.stringify(rootPkg, null, 2) + '\n');
      changed = true;
    }

    // 2. Add published dep to example
    const pkg = JSON.parse(fs.readFileSync(EXAMPLE_PKG_PATH, 'utf8'));
    const currentDep = pkg.dependencies?.[LIB_NAME];
    if (currentDep !== version) {
      pkg.dependencies = pkg.dependencies || {};
      pkg.dependencies[LIB_NAME] = version;
      fs.writeFileSync(EXAMPLE_PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
      changed = true;
    }

    // 3. Create standalone lockfile so Yarn treats example as independent project
    if (!fs.existsSync(EXAMPLE_LOCKFILE)) {
      fs.writeFileSync(EXAMPLE_LOCKFILE, '');
      changed = true;
    }
  }

  if (changed) {
    console.log(`[resolve-deps] ${LIB_NAME}: ${isLocal ? 'local' : version}`);
    process.exit(2);
  }
}

main();
