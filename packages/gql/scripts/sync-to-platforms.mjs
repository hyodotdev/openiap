#!/usr/bin/env bun
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
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

console.log('🎉 Platform sync complete!\n');
