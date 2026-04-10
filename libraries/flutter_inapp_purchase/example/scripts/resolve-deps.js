/**
 * Reads libraries-versions.jsonc and patches example pubspec.yaml.
 * - "local": use local path dependency (default)
 * - "<version>": use published pub.dev package
 *
 * Run: node scripts/resolve-deps.js
 */
const fs = require('fs');
const path = require('path');

/** Strip // comments from JSONC content */
const parseJsonc = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));

const VERSIONS_PATH = path.resolve(__dirname, '../../../../libraries-versions.jsonc');
const PUBSPEC_PATH = path.resolve(__dirname, '../pubspec.yaml');
const LIB_NAME = 'flutter_inapp_purchase';

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

  let content = fs.readFileSync(PUBSPEC_PATH, 'utf8');
  const original = content;

  // Match version with optional prerelease (e.g. ^9.0.0-rc.1)
  const VERSION_RE = /flutter_inapp_purchase:\s*\^[\d][^\n]*/;
  const PATH_RE = /flutter_inapp_purchase:\n\s+path:\s*\.\.\//;

  if (isLocal) {
    if (VERSION_RE.test(content)) {
      content = content.replace(VERSION_RE, `flutter_inapp_purchase:\n    path: ../`);
    }
  } else {
    if (PATH_RE.test(content)) {
      content = content.replace(PATH_RE, `flutter_inapp_purchase: ^${version}`);
    } else if (VERSION_RE.test(content)) {
      content = content.replace(VERSION_RE, `flutter_inapp_purchase: ^${version}`);
    }
  }

  if (content !== original) {
    fs.writeFileSync(PUBSPEC_PATH, content);
    console.log(`[resolve-deps] ${LIB_NAME}: ${isLocal ? 'local' : version}`);
    process.exit(2);
  }
}

main();
