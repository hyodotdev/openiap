#!/usr/bin/env node
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, '..');
const TARGET_REPOSITORY_PATH = 'libraries/expo-iap/src/types.ts';
const TARGET_FILE = join(PROJECT_ROOT, 'src', 'types.ts');
const GENERATED_HEADER = 'AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY';
const HEADER_GUIDANCE =
  'Refresh this file with the generated-types workflow documented for your checkout.';
const REPRESENTATIVE_DECLARATION = 'export interface ProductRequest';
const HEADER_SEPARATOR =
  '// ============================================================================';
const HEADER_LINE = `// ${GENERATED_HEADER}`;

function normalizeDocsTag(value) {
  const normalizedVersion = value.trim().replace(/^(?:docs-|gql-v?|v)/, '');
  if (
    normalizedVersion.length === 0 ||
    !/^[0-9A-Za-z][0-9A-Za-z.+_-]*$/.test(normalizedVersion)
  ) {
    throw new Error(
      `expo-iap: Invalid OpenIAP spec version ${JSON.stringify(value)}.`,
    );
  }
  return `docs-${normalizedVersion}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let version = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tag') {
      const next = args[i + 1];
      if (typeof next !== 'string' || next.startsWith('--')) {
        throw new Error('expo-iap: --tag requires a version.');
      }
      version = next;
      i++;
      continue;
    }
    throw new Error(`expo-iap: Unknown argument ${arg}.`);
  }

  return {version};
}

function readPinnedSpecVersion() {
  let versions;
  try {
    versions = JSON.parse(
      readFileSync(join(PROJECT_ROOT, 'openiap-versions.json'), 'utf8'),
    );
  } catch (error) {
    throw new Error(
      `expo-iap: Unable to load openiap-versions.json (${error instanceof Error ? error.message : error}). Provide --tag <version> to override it.`,
    );
  }

  const version = versions?.spec;
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error(
      'expo-iap: "spec" version missing in openiap-versions.json. Provide --tag <version> manually or update the file.',
    );
  }
  return version;
}

function getDownloadUrl(tag) {
  return `https://raw.githubusercontent.com/hyodotdev/openiap/${tag}/${TARGET_REPOSITORY_PATH}`;
}

function validateDownloadedTypes(path) {
  const contents = readFileSync(path, 'utf8');
  const lines = contents.split(/\r?\n/);
  if (
    lines[0] !== HEADER_SEPARATOR ||
    lines[1] !== HEADER_LINE ||
    !contents.includes(REPRESENTATIVE_DECLARATION) ||
    !contents.endsWith('\n')
  ) {
    throw new Error(
      'expo-iap: Downloaded file is not the expected generated TypeScript target.',
    );
  }
}

function normalizeGeneratedHeader(path) {
  const contents = readFileSync(path, 'utf8');
  const lineEnding = contents.includes('\r\n') ? '\r\n' : '\n';
  const lines = contents.split(/\r?\n/);
  const expectedGuidance = `// ${HEADER_GUIDANCE}`;
  const closingSeparator = lines.indexOf(HEADER_SEPARATOR, 2);
  const guidanceLines = lines
    .slice(2, closingSeparator)
    .map((line, index) => ({index: index + 2, line}))
    .filter(
      ({line}) =>
        line === expectedGuidance ||
        /^\/\/ Run `[^`\r\n]+`[^\r\n]*\.$/.test(line),
    );
  if (closingSeparator < 0 || guidanceLines.length !== 1) {
    throw new Error(
      'expo-iap: Downloaded file has an unexpected generated header.',
    );
  }
  if (guidanceLines[0].line !== expectedGuidance) {
    lines[guidanceLines[0].index] = expectedGuidance;
    writeFileSync(path, lines.join(lineEnding));
  }
}

function main() {
  const {version: versionOverride} = parseArgs();
  const tag = normalizeDocsTag(versionOverride ?? readPinnedSpecVersion());
  const downloadUrl = getDownloadUrl(tag);
  const tempDir = mkdtempSync(join(dirname(TARGET_FILE), '.openiap-types-'));
  const tempFile = join(tempDir, 'types.ts');

  try {
    console.log(`Downloading OpenIAP types (tag: ${tag}) from ${downloadUrl}`);
    execFileSync('curl', ['-fL', '-o', tempFile, downloadUrl], {
      stdio: 'inherit',
    });

    validateDownloadedTypes(tempFile);
    normalizeGeneratedHeader(tempFile);
    validateDownloadedTypes(tempFile);
    chmodSync(tempFile, 0o644);
    renameSync(tempFile, TARGET_FILE);
    console.log(`Updated src/types.ts from tag ${tag}`);
  } finally {
    rmSync(tempDir, {recursive: true, force: true});
  }
}

main();
