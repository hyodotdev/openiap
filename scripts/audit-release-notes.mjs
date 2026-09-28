#!/usr/bin/env node

// A PR into main that changes what a published package ships also updates the
// release card (AGENTS.md "Docs Ship With The Change"). #482, #484, #488 and
// #489 shipped without one. A behavior-neutral change carries "፦ refactor".

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_NOTES = "packages/docs/src/pages/docs/updates/releases.tsx";

// What each published package ships; manifests stay out so dependency bumps pass.
export const publishedSourcePatterns = [
  /^packages\/google\/openiap\/src\/(main|play|horizon|amazon)\//,
  /^packages\/google\/openiap\/(build\.gradle\.kts|consumer-rules[\w-]*\.pro)$/,
  /^packages\/google\/gradle\/[^/]+\.gradle$/,
  /^packages\/google\/gradle-plugin\/src\/main\//,
  /^packages\/apple\/Sources\//,
  /^packages\/apple\/(Package\.swift|openiap\.podspec)$/,
  /^packages\/cli\/src\//,
  /^libraries\/react-native-iap\/(src|ios|android\/src\/main)\//,
  /^libraries\/react-native-iap\/(android\/[^/]+\.gradle|NitroIap\.podspec|nitro\.json)$/,
  /^libraries\/expo-iap\/(src|ios|plugin\/src|android\/src\/main)\//,
  /^libraries\/expo-iap\/(android\/[^/]+\.gradle|app\.plugin\.js|expo-module\.config\.json)$/,
  /^libraries\/flutter_inapp_purchase\/(lib|ios|macos|android\/src\/(main|none|store))\//,
  /^libraries\/flutter_inapp_purchase\/android\/[^/]+\.gradle$/,
  /^libraries\/godot-iap\/(addons\/godot-iap|android\/src\/main|ios-gdextension)\//,
  /^libraries\/godot-iap\/android\/build\.gradle\.kts$/,
  /^libraries\/kmp-iap\/library\/src\/(commonMain|androidMain|iosMain)\//,
  /^libraries\/kmp-iap\/library\/build\.gradle\.kts$/,
  /^libraries\/maui-iap\/(src|android\/openiap)\//,
];

const isTest = (file) =>
  /(^|\/)(__tests__|__mocks__|tests?)\//.test(file) ||
  /\.(test|spec)\.[^./]+$/.test(file);

export function findUnnotedSourceChanges(files) {
  if (files.includes(RELEASE_NOTES)) return [];
  return files.filter(
    (file) =>
      !isTest(file) &&
      publishedSourcePatterns.some((pattern) => pattern.test(file)),
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const base = process.argv[2] ?? "HEAD^1";
  const files = execFileSync("git", ["diff", "--name-only", base, "HEAD"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const unnoted = findUnnotedSourceChanges(files);
  if (unnoted.length > 0) {
    console.error(
      `::error::These files ship in a published package, but ${RELEASE_NOTES} is unchanged. ` +
        `Add the change to the next release card (written as already published), ` +
        `or label a behavior-neutral PR "፦ refactor" and re-run this job.`,
    );
    for (const file of unnoted) console.error(`- ${file}`);
    process.exitCode = 1;
  } else {
    console.log("Release note audit: clean.");
  }
}
