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

// ── Reading the Expo config ────────────────────────────────────────────────
//
// This audit reads one config file that this repository owns. Earlier versions
// tried to resolve what a config would evaluate to — spreads, ternaries,
// bindings, reassignment — and every review round found another shape that
// either slipped past or was wrongly refused, because that job is evaluation,
// not reading.
//
// So the reader models one shape and reports everything else: plain object
// literals, plain keys, and a literal app id. "Write it plainly" is a cost this
// repository can pay for its own example; guessing what a config resolves to is
// how an unverified app id shipped looking verified.

// The masker blanks a string with its quotes, so a string literal looks like
// whitespace here. Stopping at a quote in the source keeps a skip from walking
// straight over a value; a blanked comment has no quote and is skipped.
const skipSpace = (contents, masked, index) => {
  while (index < masked.length && /\s/u.test(masked[index])) {
    const quote = contents[index];
    if (quote === '"' || quote === "'" || quote === "`") break;
    index += 1;
  }
  return index;
};

const NAME = /[A-Za-z_$][\w$]*/y;

// A dotted path such as `process.env.X` is a value, not a structure to follow.
const readName = (masked, start) => {
  NAME.lastIndex = start;
  const named = NAME.exec(masked);
  if (!named || named.index !== start) return -1;
  let index = start + named[0].length;
  for (;;) {
    if (masked[index] !== ".") return index;
    NAME.lastIndex = index + 1;
    const next = NAME.exec(masked);
    if (!next || next.index !== index + 1) return index;
    index = index + 1 + next[0].length;
  }
};

// End offset of one value, or -1 for anything this reader does not model.
const readValue = (contents, masked, start) => {
  const opening = masked[start];
  if (opening === "{" || opening === "[") {
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    for (let index = start; index < masked.length; index += 1) {
      if (masked[index] === opening) depth += 1;
      else if (masked[index] === closing) {
        depth -= 1;
        if (depth === 0) return index + 1;
      }
    }
    return -1;
  }
  const quote = contents[start];
  if (quote === '"' || quote === "'") {
    const close = contents.indexOf(quote, start + 1);
    return close < 0 ? -1 : close + 1;
  }
  return readName(masked, start);
};

/**
 * Members of a plain object literal, keyed by property name, or null when the
 * literal holds anything this reader does not model.
 *
 * A later key wins, matching the language. Requiring a `,` or `}` right after
 * each value is what makes the reader strict: `a ? b : c`, `f(x)`, a template
 * literal and a spread all continue past the value with something else, so each
 * is reported instead of half-read.
 */
const readMembers = (contents, masked, start) => {
  if (masked[start] !== "{") return null;
  const members = new Map();
  let index = skipSpace(contents, masked, start + 1);
  while (index < masked.length && masked[index] !== "}") {
    let key;
    let after;
    const quote = contents[index];
    if (quote === '"' || quote === "'") {
      // The masker blanks a string with its quotes, so a quoted key is only
      // visible in the source.
      const close = contents.indexOf(quote, index + 1);
      if (close < 0) return null;
      key = contents.slice(index + 1, close);
      after = close + 1;
    } else {
      const end = readName(masked, index);
      if (end < 0 || masked.slice(index, end).includes(".")) return null;
      key = masked.slice(index, end);
      after = end;
    }

    after = skipSpace(contents, masked, after);
    if (masked[after] === "," || masked[after] === "}") {
      members.set(key, { shorthand: true, start: index, end: after });
      index = after;
    } else if (masked[after] === ":") {
      const valueStart = skipSpace(contents, masked, after + 1);
      const valueEnd = readValue(contents, masked, valueStart);
      if (valueEnd < 0) return null;
      members.set(key, { shorthand: false, start: valueStart, end: valueEnd });
      index = valueEnd;
    } else {
      return null;
    }

    index = skipSpace(contents, masked, index);
    if (masked[index] === ",") index = skipSpace(contents, masked, index + 1);
    else if (masked[index] !== "}") return null;
  }
  return masked[index] === "}" ? members : null;
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
  // A regex cannot span a type annotation: `[^=]*` crossed a statement
  // boundary, and `[^=;]*` stopped at the semicolons inside a type literal.
  // Find the declaration, then walk any annotation by nesting depth.
  const pattern = new RegExp(String.raw`\b(?:const|let|var)\s+${name}\b`, "g");
  // From just past the name, skip whitespace and any `: <type>` annotation,
  // then require `= {`. Returns the offset of that `{`, or -1.
  const initialiserAt = (from) => {
    let index = from;
    while (index < masked.length && /\s/u.test(masked[index])) index += 1;
    if (masked[index] === ":") {
      index += 1;
      let depth = 0;
      while (index < masked.length) {
        const character = masked[index];
        if ("{([<".includes(character)) depth += 1;
        else if ("})]>".includes(character)) depth -= 1;
        else if (depth === 0 && character === "=") break;
        else if (depth === 0 && (character === ";" || character === ",")) return -1;
        index += 1;
      }
    }
    while (index < masked.length && /\s/u.test(masked[index])) index += 1;
    if (masked[index] !== "=") return -1;
    index += 1;
    while (index < masked.length && /\s/u.test(masked[index])) index += 1;
    return masked[index] === "{" ? index : -1;
  };

  let visible = null;
  for (const binding of contents.matchAll(pattern)) {
    // A commented-out declaration is not a declaration.
    if (masked[binding.index] !== contents[binding.index]) continue;
    const opening = initialiserAt(binding.index + binding[0].length);
    if (opening < 0) continue;

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
    visible = extractBalancedBlock(masked, opening);
  }
  return visible;
}

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

// A value that is an object: written inline, or a name bound to one.
const objectFor = (contents, masked, key, member, referenceIndex) => {
  if (member.shorthand) {
    return bindingBlock(contents, masked, key, referenceIndex);
  }
  if (masked[member.start] === "{") return [member.start, member.end];
  const named = contents.slice(member.start, member.end);
  if (!/^[A-Za-z_$][\w$]*$/u.test(named)) return null;
  return bindingBlock(contents, masked, named, member.start);
};

const UNREADABLE =
  "; write the Horizon app id as a plain literal so it can be verified";

const inspectExpoPluginConfig = (contents) => {
  // Structure comes from masked text so a brace in a string is not syntax; a
  // quoted key and the app id itself are read from the source at the same
  // offset, because the masker blanks a string with its quotes.
  const masked = maskTypeScriptCommentsAndStrings(contents);
  let block = optionsBlock(contents, masked);
  if (block === null) {
    return "passes no options object to the OpenIAP config plugin";
  }

  // Expo reads the id from `android.horizon` of those options. A `horizon`
  // block anywhere else — a local constant, a commented-out draft, an
  // unrelated export — supplies nothing to the build.
  for (const [key, where] of [
    ["android", "the plugin options"],
    ["horizon", "android"],
  ]) {
    const members = readMembers(contents, masked, block[0]);
    if (members === null) return `builds ${where} from a shape this audit cannot read${UNREADABLE}`;
    const member = members.get(key);
    if (!member) return `declares no ${key === "android" ? "android config block" : "android.horizon block"}`;
    const resolved = objectFor(contents, masked, key, member, block[0]);
    if (resolved === null) return `sets ${where === "android" ? "android.horizon" : "android"} to something this audit cannot read as an object${UNREADABLE}`;
    block = resolved;
  }

  const members = readMembers(contents, masked, block[0]);
  if (members === null) {
    return `builds android.horizon from a shape this audit cannot read${UNREADABLE}`;
  }
  const member = members.get("appId");
  if (!member || member.shorthand) {
    return "declares android.horizon without a literal appId";
  }
  const quoted = /^(['"])([^'"]*)\1$/u.exec(
    contents.slice(member.start, member.end),
  );
  if (!quoted || !LITERAL_APP_ID.test(quoted[2])) {
    return "declares android.horizon without a literal appId";
  }
  return null;
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
