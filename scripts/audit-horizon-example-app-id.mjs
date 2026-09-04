#!/usr/bin/env node
// Every example that can build the Horizon flavor must resolve a non-empty
// HORIZON_APP_ID. Horizon's billing client reads the id from the merged
// manifest and throws inside startConnection when it is missing, so an example
// that omits it still compiles and only fails once it runs on a headset.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const HORIZON_APP_ID_META_DATA_NAME =
  "com.meta.horizon.platform.HORIZON_APP_ID";

// Each example declares the id in whichever file its toolchain merges into the
// Android manifest, so each kind is checked against its own syntax.
export const HORIZON_APP_ID_SOURCES = [
  {
    library: "packages/google",
    file: "packages/google/Example/build.gradle.kts",
    kind: "gradle-fallback",
  },
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
const APP_ID_LITERAL = new RegExp(`^["']${APP_ID}["']$`);

const stripXmlComments = (source) => source.replace(/<!--[\s\S]*?-->/g, "");
const stripLineComments = (source) =>
  source.replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const APPLICATION_ELEMENT = /<application\b[\s\S]*?<\/application\s*>/;
const NESTED_ELEMENT =
  /<(activity|service|receiver|provider)\b[\s\S]*?<\/\1\s*>/g;
const META_DATA_ELEMENT = /<meta-data\b[\s\S]*?(?:\/>|<\/meta-data\s*>)/g;

// Horizon reads the id from <application>. A meta-data nested inside an
// activity or service merges somewhere the platform never looks.
const inspectAndroidManifest = (contents) => {
  const application = stripXmlComments(contents).match(APPLICATION_ELEMENT);
  if (!application) return "has no <application> element";
  const direct = application[0].replace(NESTED_ELEMENT, "");
  let declared = false;
  for (const [element] of direct.matchAll(META_DATA_ELEMENT)) {
    if (!element.includes(HORIZON_APP_ID_META_DATA_NAME)) continue;
    declared = true;
    if (new RegExp(`android:value\\s*=\\s*"${APP_ID}"`).test(element)) {
      return null;
    }
  }
  if (declared) {
    return "declares the Horizon meta-data without a literal app id";
  }
  return stripXmlComments(contents).includes(HORIZON_APP_ID_META_DATA_NAME)
    ? "declares the Horizon meta-data outside <application>"
    : "declares no Horizon app id meta-data";
};

const APP_ID_PROPERTY = /(?:HORIZON|OPENIAP)_APP_ID"\s*\)/;
const ELVIS_CONTINUATION = /^\s*\?:/;
const ELVIS_OPERAND = /\?:\s*([^\n]+?)\s*$/;

// Both Gradle examples resolve the id through an elvis chain. Only the value
// that terminates the chain reaches manifestPlaceholders, so that is what must
// be a literal — a literal anywhere else in the file is not the fallback.
const inspectGradleFallback = (contents) => {
  const source = stripLineComments(contents);
  const start = source.search(APP_ID_PROPERTY);
  if (start === -1) return "reads no Horizon app id property";
  const lines = source.slice(start).split("\n");
  const chain = [lines[0]];
  for (let index = 1; index < lines.length; index += 1) {
    if (!ELVIS_CONTINUATION.test(lines[index])) break;
    chain.push(lines[index]);
  }
  const operands = chain
    .map((line) => line.match(ELVIS_OPERAND))
    .filter(Boolean)
    .map((match) => match[1].trim());
  if (operands.length === 0) return "has no fallback for the Horizon app id";
  const terminal = operands[operands.length - 1];
  if (APP_ID_LITERAL.test(terminal)) return null;
  return terminal === '""' || terminal === "''"
    ? "falls back to an empty app id"
    : `falls back to ${terminal} instead of a literal Horizon app id`;
};

const EXPO_HORIZON_APP_ID = new RegExp(
  String.raw`horizon\s*:\s*\{[^}]*?appId\s*:\s*['"]${APP_ID}['"]`,
);

const inspectExpoPluginConfig = (contents) =>
  EXPO_HORIZON_APP_ID.test(stripLineComments(contents))
    ? null
    : "does not set a literal horizon.appId";

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

// pathToFileURL, not `file://${argv[1]}` — the latter never matches when the
// checkout path needs percent-encoding, which turns this CLI into a silent
// no-op that exits 0.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
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
