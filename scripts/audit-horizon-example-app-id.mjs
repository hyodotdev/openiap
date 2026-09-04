#!/usr/bin/env node
// Every example that can build the Horizon flavor must declare
// com.meta.horizon.platform.HORIZON_APP_ID, because the billing client reads it
// from the merged manifest and throws inside startConnection when it is absent.
// An example that omits it still compiles and only fails on a headset.
//
// This audit checks the DECLARATION, which is a static property of the source.
// It deliberately does not try to prove what a Gradle expression resolves to —
// that depends on which properties are set and how the expression
// short-circuits, and reading it out of the build file's text can only
// approximate it. `scripts/verify-horizon-merged-manifest.mjs` checks the value
// the manifest merger actually produced.
//
// CI runs that merger check for every "templated-manifest" source, each on its
// own workflow; security/README.md lists them. Do not fold it back in here by
// reading the build file's text — the value is decided by the merger, not by
// the source.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { maskTypeScriptCommentsAndStrings } from "./audit-purchase-payload-parity.mjs";
import { parseXml, XmlParseError } from "./xml-document.mjs";

export const HORIZON_APP_ID_META_DATA_NAME =
  "com.meta.horizon.platform.HORIZON_APP_ID";

// "android-manifest"    — the manifest carries the literal id
// "templated-manifest"  — the manifest carries a Gradle placeholder, and the
//                         resolved value is checked against a merged manifest
//                         in that target's own CI workflow
// "expo-plugin-config"  — the config plugin binds the id
export const HORIZON_APP_ID_SOURCES = [
  {
    library: "packages/google",
    file: "packages/google/Example/src/main/AndroidManifest.xml",
    kind: "templated-manifest",
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
    file: "libraries/flutter_inapp_purchase/example/android/app/src/main/AndroidManifest.xml",
    kind: "templated-manifest",
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

// Replace to a fixpoint: removing an inner `<!-- -->` can splice `<!-` and `-`
// into a new opener the pass never saw, so one substitution is not a strip.
const stripXmlComments = (source) => {
  let previous;
  let current = source;
  do {
    previous = current;
    current = previous.replace(/<!--[\s\S]*?-->/g, "");
  } while (current !== previous);
  return current;
};

const APPLICATION_ELEMENT =
  /<application\b(?:[^>]*\/>|[\s\S]*?<\/application\s*>)/;
// activity-alias precedes activity: the alternation is ordered, and
// `activity\b` would otherwise claim the prefix and mis-pair the closing tag.
// The self-closing form comes first: without it the lazy body would start at
// `<provider .../>` and run to a LATER `</provider>`, swallowing every
// application-level element in between — including the Horizon meta-data.
const NESTED_ELEMENT =
  /<(activity-alias|activity|service|receiver|provider)\b(?:[^>]*\/>|[\s\S]*?<\/\1\s*>)/g;
const META_DATA_ELEMENT = /<meta-data\b[\s\S]*?(?:\/>|<\/meta-data\s*>)/g;
const NAME_ATTRIBUTE = /android:name\s*=\s*["']([^"']*)["']/;
const LITERAL_VALUE = new RegExp(`android:value\\s*=\\s*["']${APP_ID}["']`);
const PLACEHOLDER_VALUE = /android:value\s*=\s*["']\$\{(\w+)\}["']/;

// Horizon reads the id from <application>. A meta-data nested inside an
// activity or service merges somewhere the platform never looks.
const allMetaData = (element, found = []) => {
  if (element.name === "meta-data") found.push(element);
  for (const child of element.children) allMetaData(child, found);
  return found;
};

const isHorizon = (element) =>
  element.attribute("android:name") === HORIZON_APP_ID_META_DATA_NAME;

const LITERAL_APP_ID = new RegExp(`^${APP_ID}$`);
const PLACEHOLDER_APP_ID = /^\$\{\w+\}$/;

const inspectManifest = (contents, allowPlaceholder) => {
  // Parsed, not pattern-matched: android:name must be an attribute rather than
  // text inside another attribute's value, and a self-closing sibling must not
  // swallow the elements that follow it.
  let root;
  try {
    root = parseXml(contents, {});
  } catch (error) {
    if (error instanceof XmlParseError) {
      return `is not well-formed XML: ${error.message}`;
    }
    throw error;
  }
  const application = root.first("application");
  if (!application) return "has no <application> element";

  let declared = false;
  for (const element of application.all("meta-data").filter(isHorizon)) {
    declared = true;
    // The merger honours tools:node="remove", so a declaration carrying it is
    // deleted from the manifest the platform actually reads.
    if (element.attribute("tools:node") === "remove") continue;
    const value = element.attribute("android:value") ?? "";
    if (LITERAL_APP_ID.test(value)) return null;
    if (allowPlaceholder && PLACEHOLDER_APP_ID.test(value)) return null;
  }
  if (declared) {
    return allowPlaceholder
      ? "declares the Horizon meta-data without a literal app id or a placeholder"
      : "declares the Horizon meta-data without a literal app id";
  }
  return allMetaData(root).some(isHorizon)
    ? "declares the Horizon meta-data outside <application>"
    : "declares no Horizon app id meta-data";
};

// Brace-balanced over masked text, so a brace inside a string neither truncates
// the block nor stretches it into a later one.
const extractBalancedBlock = (masked, from) => {
  let depth = 0;
  for (let index = from; index < masked.length; index += 1) {
    if (masked[index] === "{") depth += 1;
    else if (masked[index] === "}") {
      depth -= 1;
      if (depth === 0) return [from, index + 1];
    }
  }
  return null;
};

const ANDROID_KEY = /\bandroid\s*:\s*\{/g;
const HORIZON_KEY = /\bhorizon\s*:\s*\{/g;
const APP_ID_ENTRY = new RegExp(
  String.raw`\bappId\s*:\s*['"]${APP_ID}['"]`,
  "g",
);

const inspectExpoPluginConfig = (contents) => {
  // Structure comes from masked text so a brace in a string is not syntax; the
  // value is read from the source at the same offset, and a match only counts
  // when the masker left that position intact — a commented-out entry does not.
  const masked = maskTypeScriptCommentsAndStrings(contents);
  // Expo reads the id from `android.horizon`. A `horizon` block anywhere else
  // in the file — a local constant, a commented-out draft, an unrelated
  // export — supplies nothing to the build, so search only inside `android`.
  const androidBlocks = [];
  for (const match of masked.matchAll(ANDROID_KEY)) {
    const span = extractBalancedBlock(
      masked,
      match.index + match[0].length - 1,
    );
    if (span !== null) androidBlocks.push(span);
  }
  if (androidBlocks.length === 0) return "declares no android config block";

  let declared = false;
  for (const [androidStart, androidEnd] of androidBlocks) {
    const scope = masked.slice(androidStart, androidEnd);
    for (const match of scope.matchAll(HORIZON_KEY)) {
      const span = extractBalancedBlock(
        masked,
        androidStart + match.index + match[0].length - 1,
      );
      if (span === null) continue;
      declared = true;
      for (const entry of contents
        .slice(span[0], span[1])
        .matchAll(APP_ID_ENTRY)) {
        const at = span[0] + entry.index;
        if (masked[at] === contents[at]) return null;
      }
    }
  }
  return declared
    ? "declares android.horizon without a literal appId"
    : "does not set a literal android.horizon.appId";
};

const INSPECTORS = {
  "android-manifest": (contents) => inspectManifest(contents, false),
  "templated-manifest": (contents) => inspectManifest(contents, true),
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
    `OK ${HORIZON_APP_ID_SOURCES.length} Horizon examples declare an app id`,
  );
}
