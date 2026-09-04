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
// Android manifest, so each kind is checked against its own syntax.
export const HORIZON_APP_ID_SOURCES = [
  {
    library: "react-native-iap",
    file: "libraries/react-native-iap/example/android/app/src/main/AndroidManifest.xml",
    kind: "android-manifest",
  },
  {
    library: "expo-iap",
    file: "libraries/expo-iap/example/app.config.ts",
    kind: "expo-plugin-config",
  },
  {
    library: "flutter_inapp_purchase",
    file: "libraries/flutter_inapp_purchase/example/android/app/build.gradle",
    kind: "gradle-fallback",
  },
  {
    library: "kmp-iap",
    file: "libraries/kmp-iap/example/composeApp/src/androidMain/AndroidManifest.xml",
    kind: "android-manifest",
  },
  {
    library: "maui-iap",
    file: "libraries/maui-iap/example/OpenIap.Maui.Example/Platforms/Android/AndroidManifest.xml",
    kind: "android-manifest",
  },
];

// Horizon app ids are long numeric strings. The literal only counts when it is
// bound to the Horizon declaration: a bare number elsewhere in the file leaves
// the merged manifest just as empty.
const APP_ID = String.raw`\d{10,}`;

const XML_COMMENTS = /<!--[\s\S]*?-->/g;
const META_DATA_ELEMENT = /<meta-data\b[\s\S]*?(?:\/>|<\/meta-data>)/g;

const inspectAndroidManifest = (contents) => {
  const source = contents.replace(XML_COMMENTS, "");
  let declared = false;
  for (const [element] of source.matchAll(META_DATA_ELEMENT)) {
    if (!element.includes(HORIZON_APP_ID_META_DATA_NAME)) continue;
    declared = true;
    if (new RegExp(`android:value\\s*=\\s*"${APP_ID}"`).test(element)) {
      return null;
    }
  }
  return declared
    ? "declares the Horizon meta-data without a literal app id"
    : "declares no Horizon app id meta-data";
};

const inspectGradleFallback = (contents) => {
  const read = String.raw`HORIZON_APP_ID"\s*\)\s*\?:\s*`;
  if (new RegExp(`${read}"${APP_ID}"`).test(contents)) return null;
  if (new RegExp(`${read}(?:""|'')`).test(contents)) {
    return "falls back to an empty app id";
  }
  return "does not fall back to a literal Horizon app id";
};

const inspectExpoPluginConfig = (contents) => {
  const bound = new RegExp(
    String.raw`horizon\s*:\s*\{[^}]*?appId\s*:\s*['"]${APP_ID}['"]`,
  );
  return bound.test(contents) ? null : "does not set a literal horizon.appId";
};

const INSPECTORS = {
  "android-manifest": inspectAndroidManifest,
  "gradle-fallback": inspectGradleFallback,
  "expo-plugin-config": inspectExpoPluginConfig,
};

export function inspectHorizonAppIdSource(contents, kind) {
  const inspect = INSPECTORS[kind];
  if (!inspect) return `unknown source kind ${JSON.stringify(kind)}`;
  return inspect(contents);
}

export function collectHorizonExampleAppIdFailures(repoRoot) {
  const failures = [];
  for (const { library, file, kind } of HORIZON_APP_ID_SOURCES) {
    const absolute = path.resolve(repoRoot, file);
    if (!fs.existsSync(absolute)) {
      failures.push(`${library}: ${file} is missing`);
      continue;
    }
    const issue = inspectHorizonAppIdSource(
      fs.readFileSync(absolute, "utf8"),
      kind,
    );
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
