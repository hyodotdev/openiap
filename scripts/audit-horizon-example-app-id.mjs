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

// Horizon reads the id from <application>. A meta-data nested inside an
// activity or service merges somewhere the platform never looks.
const allMetaData = (element, found = []) => {
  if (element.name === "meta-data") found.push(element);
  for (const child of element.children) allMetaData(child, found);
  return found;
};

const isHorizon = (element) =>
  element.attribute("android:name") === HORIZON_APP_ID_META_DATA_NAME;

const TOOLS_NAMESPACE = "http://schemas.android.com/tools";

// Prefixes bound to the tools namespace anywhere in the document.
const toolsPrefixes = (root) => {
  const found = new Set();
  const visit = (element) => {
    for (const [name, value] of element.attributes) {
      if (name.startsWith("xmlns:") && value === TOOLS_NAMESPACE) {
        found.add(name.slice("xmlns:".length));
      }
    }
    for (const child of element.children) visit(child);
  };
  visit(root);
  return [...found];
};

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
    // The merger honours the tools namespace, whatever prefix the document
    // binds it to — `xmlns:t=".../tools"` makes `t:node` equivalent.
    // `remove` deletes this element; `removeAll` deletes every matching one
    // under the parent. Either way the platform never sees the declaration.
    if (
      toolsPrefixes(root).some((prefix) =>
        ["remove", "removeAll"].includes(element.attribute(`${prefix}:node`)),
      )
    ) {
      continue;
    }
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

// Property lookups walk brace depth so only DIRECT members count: the plugin
// reads `android.horizon.appId`, and `android.decoy.horizon.appId` supplies
// nothing. A regex alone cannot tell the two apart.
const directKeyOffsets = (masked, [start, end], name) => {
  const key = new RegExp(String.raw`\b${name}\s*:\s*\{`, "g");
  const offsets = [];
  let depth = 0;
  for (let index = start + 1; index < end - 1; index += 1) {
    const character = masked[index];
    if (character === "}") {
      depth -= 1;
      continue;
    }
    if (character !== "{") {
      if (depth !== 0) continue;
      key.lastIndex = index;
      const match = key.exec(masked);
      if (match && match.index === index) {
        offsets.push(index + match[0].length - 1);
        index = match.index + match[0].length - 1;
      }
      continue;
    }
    depth += 1;
  }
  return offsets;
};

// Spread elements at depth 0 of the given block.
const directSpreadOffsets = (masked, [start, end]) => {
  const offsets = [];
  let depth = 0;
  for (let index = start + 1; index < end - 1; index += 1) {
    const character = masked[index];
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (depth === 0 && masked.startsWith("...", index))
      offsets.push(index);
  }
  return offsets;
};

// A literal appId directly on the horizon object, not nested deeper.
// `{android: {horizon}}` is shorthand for `{android: {horizon: horizon}}`, so
// the value can be a binding rather than a literal object. Resolving one level
// keeps a legitimate config from being reported as missing the id.
// The binding must be visible from where it is referenced: either module
// scope, or a block that encloses the reference. A same-named binding inside an
// unrelated function is a different variable, and picking it let a fixture's
// object stand in for the one the plugin receives.
function bindingBlock(contents, masked, name, referenceIndex) {
  // `[^=]*` used to cross a statement boundary: `let options;` followed by
  // `const metadata = {` matched, and the unrelated object was inspected as
  // though it were the binding. Allow only a type annotation between the name
  // and its `=`.
  const pattern = new RegExp(
    String.raw`\b(?:const|let|var)\s+${name}\s*(?::[^=;{}]*)?=\s*\{`,
    "g",
  );
  let visible = null;
  for (const binding of contents.matchAll(pattern)) {
    // A commented-out declaration is not a declaration.
    if (masked[binding.index] !== contents[binding.index]) continue;

    // The innermost block still open at the declaration is its scope.
    const open = [];
    for (let index = 0; index < binding.index; index += 1) {
      if (masked[index] === "{") open.push(index);
      else if (masked[index] === "}") open.pop();
    }
    // The reference must fall inside the declaration's scope AND after the
    // declaration itself. Checking only the end let a binding declared later,
    // in an unrelated block, shadow the one the plugin actually receives.
    if (referenceIndex < binding.index) continue;
    if (open.length > 0) {
      const scope = extractBalancedBlock(masked, open[open.length - 1]);
      if (scope === null) continue;
      if (referenceIndex <= scope[0] || referenceIndex >= scope[1]) continue;
    }
    visible = extractBalancedBlock(
      masked,
      binding.index + binding[0].length - 1,
    );
  }
  return visible;
}

// A shorthand property `{ …, horizon, … }` at depth 0 of the given block.
const directShorthand = (masked, [start, end], name) => {
  const shorthand = new RegExp(String.raw`${name}\s*(?=[,}])`, "y");
  let depth = 0;
  for (let index = start + 1; index < end - 1; index += 1) {
    const character = masked[index];
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (depth === 0 && /[A-Za-z_$]/u.test(character)) {
      const before = masked[index - 1];
      if (before !== undefined && /[\w$.]/u.test(before)) continue;
      shorthand.lastIndex = index;
      if (shorthand.test(masked)) return true;
    }
  }
  return false;
};

const directAppId = (masked, contents, [start, end]) => {
  let depth = 0;
  for (let index = start + 1; index < end - 1; index += 1) {
    const character = masked[index];
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (depth === 0) {
      APP_ID_ENTRY.lastIndex = index;
      const match = APP_ID_ENTRY.exec(contents);
      if (match && match.index === index && masked[index] === contents[index]) {
        return true;
      }
    }
  }
  return false;
};
const APP_ID_ENTRY = new RegExp(
  String.raw`\bappId\s*:\s*['"]${APP_ID}['"]`,
  "g",
);

// The plugin entry names the options the build actually receives — either an
// inline object or an identifier bound to one. Anything else in the module is
// a decoy: a stale constant left by a refactor supplies nothing.
//
// What this cannot prove: that the tuple is still in the exported `plugins`
// array. The real config assembles that array through a binding and pushes to
// it conditionally, so following it would mean evaluating the module rather
// than reading it. A tuple left behind while the exported array is emptied
// therefore still passes. This audit catches a forgotten or malformed app id,
// which is the accident that actually happens; proving what the build resolves
// is the merged-manifest verifier's job, and Expo has no such gate today.
const PLUGIN_ENTRY = /\[\s*['"][^'"]*app\.plugin\.js['"]\s*,\s*/g;
const IDENTIFIER = /^([A-Za-z_$][\w$]*)/;

// The plugin path is a string literal, which the masker blanks out, so the
// entry is located in the source. Offsets are preserved, so brace matching
// still runs over the masked text where a brace in a string is not syntax.
const optionsBlock = (contents, masked) => {
  for (const entry of contents.matchAll(PLUGIN_ENTRY)) {
    // The masker blanks comments and string bodies, so an entry the masker
    // did not leave intact is commented out and supplies nothing.
    if (masked[entry.index] !== contents[entry.index]) continue;
    const after = entry.index + entry[0].length;
    if (contents[after] === "{") return extractBalancedBlock(masked, after);
    const named = contents.slice(after).match(IDENTIFIER);
    if (!named) continue;
    const bound = bindingBlock(contents, masked, named[1], entry.index);
    if (bound) return bound;
  }
  return null;
};

const inspectExpoPluginConfig = (contents) => {
  // Structure comes from masked text so a brace in a string is not syntax; the
  // value is read from the source at the same offset, and a match only counts
  // when the masker left that position intact — a commented-out entry does not.
  const masked = maskTypeScriptCommentsAndStrings(contents);
  const options = optionsBlock(contents, masked);
  if (options === null) {
    return "passes no options object to the OpenIAP config plugin";
  }

  // Expo reads the id from `android.horizon` of those options. A `horizon`
  // block anywhere else — a local constant, a commented-out draft, an
  // unrelated export — supplies nothing to the build.
  const androidBlocks = directKeyOffsets(masked, options, "android")
    .map((offset) => extractBalancedBlock(masked, offset))
    .filter(Boolean);
  if (androidBlocks.length === 0) return "declares no android config block";

  // A spread AFTER the key replaces it — `{horizon: {...}, ...d}` leaves
  // whatever `d.horizon` holds — so reading the literal would assert a value
  // the build never sees. A spread BEFORE the key is harmless: the later
  // explicit property wins, and that ordering is decidable without evaluating
  // the module.
  for (const android of androidBlocks) {
    const spreads = directSpreadOffsets(masked, android);
    if (spreads.length === 0) continue;
    const keys = directKeyOffsets(masked, android, "horizon");
    const lastKey = keys.length > 0 ? keys[keys.length - 1] : -1;
    if (spreads.some((offset) => offset > lastKey)) {
      return "spreads an object into android after horizon, so the resolved appId is not readable here";
    }
  }

  let declared = false;
  for (const android of androidBlocks) {
    const spans = directKeyOffsets(masked, android, "horizon")
      .map((offset) => extractBalancedBlock(masked, offset))
      .filter(Boolean);
    // `{android: {horizon}}` names a binding instead of nesting an object. The
    // shorthand must be a DIRECT member of android — `{android: {x: {horizon}}}`
    // supplies nothing — so the search walks depth like the key lookup does.
    if (spans.length === 0 && directShorthand(masked, android, "horizon")) {
      const bound = bindingBlock(contents, masked, "horizon", android[0]);
      if (bound) spans.push(bound);
    }
    for (const span of spans) {
      declared = true;
      if (directAppId(masked, contents, span)) return null;
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
