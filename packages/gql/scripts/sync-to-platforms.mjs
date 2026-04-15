#!/usr/bin/env bun
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const gqlRoot = resolve(__dirname, '..');
const monorepoRoot = resolve(gqlRoot, '../..');

// Kotlin → Google (Android)
const kotlinSource = resolve(gqlRoot, 'src/generated/Types.kt');
const kotlinTarget = resolve(monorepoRoot, 'packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt');

// Swift → Apple (iOS)
const swiftSource = resolve(gqlRoot, 'src/generated/Types.swift');
const swiftTarget = resolve(monorepoRoot, 'packages/apple/Sources/Models/Types.swift');

// Library targets — generated types are copied in with per-library
// transformations (package names, file extensions, etc.) so that
// `libraries/*/` stay in lockstep with the gql schema instead of needing
// hand edits after every regeneration.
const dartSource = resolve(gqlRoot, 'src/generated/types.dart');
const dartTarget = resolve(
  monorepoRoot,
  'libraries/flutter_inapp_purchase/lib/types.dart',
);

const gdSource = resolve(gqlRoot, 'src/generated/types.gd');
const gdTarget = resolve(
  monorepoRoot,
  'libraries/godot-iap/addons/godot-iap/types.gd',
);

const tsSource = resolve(gqlRoot, 'src/generated/types.ts');
const rnTsTarget = resolve(monorepoRoot, 'libraries/react-native-iap/src/types.ts');
const expoTsTarget = resolve(monorepoRoot, 'libraries/expo-iap/src/types.ts');

const kmpSource = resolve(gqlRoot, 'src/generated/Types.kt');
const kmpTarget = resolve(
  monorepoRoot,
  'libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt',
);

console.log('📦 Syncing generated types to platforms...\n');

// Sync Kotlin to Google (Android)
if (existsSync(kotlinSource)) {
  mkdirSync(dirname(kotlinTarget), { recursive: true });
  copyFileSync(kotlinSource, kotlinTarget);
  console.log('✅ Kotlin → Google (Android)');
  console.log(`   ${kotlinTarget}\n`);

  // Run Google post-processing
  try {
    const googleRoot = resolve(monorepoRoot, 'packages/google');
    const postProcessScript = resolve(googleRoot, 'scripts/post-process-types.sh');

    if (existsSync(postProcessScript)) {
      execSync(`bash "${postProcessScript}"`, { cwd: googleRoot, stdio: 'inherit' });
    }
  } catch (error) {
    console.warn('⚠️  Google post-processing failed (optional)');
  }
} else {
  console.warn('⚠️  Kotlin types not found, skipping Google sync');
}

// Sync Swift to Apple (iOS)
if (existsSync(swiftSource)) {
  mkdirSync(dirname(swiftTarget), { recursive: true });
  copyFileSync(swiftSource, swiftTarget);
  console.log('✅ Swift → Apple (iOS)');
  console.log(`   ${swiftTarget}\n`);
} else {
  console.warn('⚠️  Swift types not found, skipping Apple sync');
}

// Sync Dart to flutter_inapp_purchase
if (existsSync(dartSource)) {
  mkdirSync(dirname(dartTarget), { recursive: true });
  copyFileSync(dartSource, dartTarget);
  console.log('✅ Dart → flutter_inapp_purchase');
  console.log(`   ${dartTarget}\n`);
}

// Sync GDScript to godot-iap
if (existsSync(gdSource)) {
  mkdirSync(dirname(gdTarget), { recursive: true });
  copyFileSync(gdSource, gdTarget);
  console.log('✅ GDScript → godot-iap');
  console.log(`   ${gdTarget}\n`);
}

// Sync TypeScript to react-native-iap + expo-iap
if (existsSync(tsSource)) {
  for (const target of [rnTsTarget, expoTsTarget]) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(tsSource, target);
  }
  console.log('✅ TypeScript → react-native-iap + expo-iap');
  console.log(`   ${rnTsTarget}`);
  console.log(`   ${expoTsTarget}\n`);
}

// Sync Kotlin to kmp-iap with the library-specific package declaration and
// the enum-companion semicolon that Kotlin requires. This mirrors the
// post-process that packages/google runs; without it the KMP module would
// not compile against the upstream gql types.
if (existsSync(kmpSource)) {
  mkdirSync(dirname(kmpTarget), { recursive: true });
  let text = readFileSync(kmpSource, 'utf8');

  // Insert package declaration after the leading @file: annotations so the
  // resulting file mirrors packages/google/.../Types.kt.
  if (!/\bpackage io\.github\.hyochan\.kmpiap\.openiap\b/.test(text)) {
    text = text.replace(
      /(@file:[^\n]+\n)(?!\s*package\b)/,
      '$1\npackage io.github.hyochan.kmpiap.openiap\n',
    );
  }

  // Kotlin enums that declare a companion object require a trailing
  // semicolon after the last enum entry. Match the same pattern used by
  // packages/google/scripts/post-process-types.sh so the files stay in
  // lockstep.
  text = text.replace(
    /(\n\s*\w+\([^)]*\))\n\n(\s+companion object)/g,
    '$1;\n\n$2',
  );

  writeFileSync(kmpTarget, text);
  console.log('✅ Kotlin → kmp-iap (with package + enum-semicolon post-process)');
  console.log(`   ${kmpTarget}\n`);
}

console.log('🎉 Platform sync complete!\n');
