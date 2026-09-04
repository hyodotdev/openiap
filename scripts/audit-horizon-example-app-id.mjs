#!/usr/bin/env node
// Every example that can build the Horizon flavor must resolve a non-empty
// HORIZON_APP_ID. Horizon's billing client reads the id from the merged
// manifest and throws inside startConnection when it is missing, so an example
// that omits it still compiles and only fails once it runs on a headset.
import fs from "node:fs";
import path from "node:path";

export const HORIZON_APP_ID_META_DATA_NAME =
  "com.meta.horizon.platform.HORIZON_APP_ID";

// Each example declares the id in whichever file its toolchain merges into the
// Android manifest.
export const HORIZON_APP_ID_SOURCES = [
  {
    library: "react-native-iap",
    file: "libraries/react-native-iap/example/android/app/src/main/AndroidManifest.xml",
  },
  {
    library: "expo-iap",
    file: "libraries/expo-iap/example/app.config.ts",
  },
  {
    library: "flutter_inapp_purchase",
    file: "libraries/flutter_inapp_purchase/example/android/app/build.gradle",
  },
  {
    library: "kmp-iap",
    file: "libraries/kmp-iap/example/composeApp/src/androidMain/AndroidManifest.xml",
  },
  {
    library: "maui-iap",
    file: "libraries/maui-iap/example/OpenIap.Maui.Example/Platforms/Android/AndroidManifest.xml",
  },
];

// A literal id, or a placeholder whose fallback is a literal id. Rejects the
// empty-string fallback that silently produces an unusable build.
const LITERAL_APP_ID = /\b\d{10,}\b/;

export function inspectHorizonAppIdSource(contents) {
  if (!LITERAL_APP_ID.test(contents)) {
    return "declares no literal Horizon app id";
  }
  for (const match of contents.matchAll(
    /HORIZON_APP_ID"?\s*\)?\s*\?:\s*(""|'')/g,
  )) {
    return `falls back to an empty app id at ${JSON.stringify(match[0])}`;
  }
  return null;
}

export function collectHorizonExampleAppIdFailures(repoRoot) {
  const failures = [];
  for (const { library, file } of HORIZON_APP_ID_SOURCES) {
    const absolute = path.resolve(repoRoot, file);
    if (!fs.existsSync(absolute)) {
      failures.push(`${library}: ${file} is missing`);
      continue;
    }
    const issue = inspectHorizonAppIdSource(fs.readFileSync(absolute, "utf8"));
    if (issue) {
      failures.push(`${library}: ${file} ${issue}`);
    }
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const failures = collectHorizonExampleAppIdFailures(repoRoot);
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  if (failures.length > 0) {
    process.exit(1);
  }
  console.log(
    `OK ${HORIZON_APP_ID_SOURCES.length} Horizon examples resolve an app id`,
  );
}
