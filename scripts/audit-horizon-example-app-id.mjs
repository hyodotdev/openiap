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
import ts from "typescript";
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

// ── Reading the Expo config ────────────────────────────────────────────────
//
// Earlier versions read this config out of masked source text, matching keys by
// regex and tracking brace depth by hand. Every review round found another
// shape it mis-read: a ternary arm taken for a value, a quoted key made
// invisible because the masker blanks strings with their quotes, an escaped key
// that JavaScript decodes to a different name, a string literal whose escaped
// delimiter ended it early.
//
// None of that is necessary. The masker this file already used is built on the
// TypeScript compiler, so a real parser was a dependency all along. Reading the
// syntax tree makes those questions the parser's, not ours.
//
// What is left is a policy, and it is deliberately narrow: follow
// `android.horizon.appId` through object literals and `const` bindings, and
// report anything else. Resolving what a config would evaluate to is
// evaluation, and this audit reads a fixed list of files this repository owns —
// "write the id plainly" is a cost we can pay.

const UNREADABLE = Symbol("unreadable");

// Follow an expression to an object literal, through the wrappers TypeScript
// allows around one and through a single `const` binding.
const objectLiteral = (node, seen = new Set()) => {
  if (!node) return null;
  if (ts.isObjectLiteralExpression(node)) return node;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return objectLiteral(node.expression, seen);
  }
  if (ts.isIdentifier(node)) {
    if (seen.has(node)) return null;
    seen.add(node);
    return objectLiteral(resolveBinding(node), seen);
  }
  return null;
};

/**
 * The initialiser an identifier resolves to, or null.
 *
 * Scope is resolved the way the language does it — innermost enclosing scope
 * first — so a same-named binding inside an unrelated function is a different
 * variable, and a parameter shadows anything outside its function. Only `const`
 * resolves: `let x = {…}; x = {}` means the declaration's text is not the value
 * the plugin receives.
 */
const resolveBinding = (identifier) => {
  for (let scope = identifier.parent; scope; scope = scope.parent) {
    const statements = ts.isSourceFile(scope)
      ? scope.statements
      : ts.isBlock(scope) || ts.isModuleBlock(scope)
        ? scope.statements
        : null;
    for (const statement of statements ?? []) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        if (declaration.name.text !== identifier.text) continue;
        if (!(statement.declarationList.flags & ts.NodeFlags.Const)) return null;
        return declaration.initializer ?? null;
      }
    }
    if (ts.isFunctionLike(scope)) {
      for (const parameter of scope.parameters ?? []) {
        if (
          ts.isIdentifier(parameter.name) &&
          parameter.name.text === identifier.text
        ) {
          return null;
        }
      }
    }
  }
  return null;
};

/**
 * The winning value of a property, UNREADABLE when the object is composed in a
 * way this audit does not model, or null when the key is absent.
 *
 * The last assignment of a key wins, matching the language. A spread AFTER that
 * assignment can replace it, and deciding whether it does means resolving the
 * spread's source — so it is reported. A spread before the winning assignment
 * loses to it and is harmless.
 */
const property = (object, name) => {
  let value = null;
  for (const member of object.properties) {
    if (ts.isSpreadAssignment(member)) {
      if (value !== null) return UNREADABLE;
      continue;
    }
    if (!member.name || ts.isComputedPropertyName(member.name)) {
      if (value !== null) return UNREADABLE;
      continue;
    }
    // `name.text` is the DECODED property name, so `"appId"` is `appId`.
    if (member.name.text !== name) continue;
    if (ts.isPropertyAssignment(member)) value = member.initializer;
    else if (ts.isShorthandPropertyAssignment(member)) value = member.name;
    else return UNREADABLE;
  }
  return value;
};

// The tuple the plugin is registered with names the options the build receives.
const pluginOptions = (source) => {
  let options;
  const visit = (node) => {
    if (options !== undefined) return;
    if (ts.isArrayLiteralExpression(node) && node.elements.length >= 2) {
      const [entry, second] = node.elements;
      if (
        (ts.isStringLiteral(entry) ||
          ts.isNoSubstitutionTemplateLiteral(entry)) &&
        /app\.plugin\.js$/u.test(entry.text)
      ) {
        options = second;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return options;
};

const inspectExpoPluginConfig = (contents) => {
  const source = ts.createSourceFile(
    "app.config.ts",
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const entry = pluginOptions(source);
  if (entry === undefined) {
    return "registers no OpenIAP config plugin entry";
  }
  let block = objectLiteral(entry);
  if (block === null) {
    return "passes no options object to the OpenIAP config plugin";
  }

  // Expo reads the id from `android.horizon` of those options. A `horizon`
  // block anywhere else — a local constant, a commented-out draft, an
  // unrelated export — supplies nothing to the build.
  for (const key of ["android", "horizon"]) {
    const value = property(block, key);
    if (value === UNREADABLE) {
      return `composes ${key === "android" ? "the plugin options" : "android"} in a way this audit cannot read; write the Horizon app id as a plain literal`;
    }
    if (value === null) {
      return key === "android"
        ? "declares no android config block"
        : "declares no android.horizon block";
    }
    block = objectLiteral(value);
    if (block === null) {
      return `sets ${key === "android" ? "android" : "android.horizon"} to something this audit cannot read as an object; write the Horizon app id as a plain literal`;
    }
  }

  const appId = property(block, "appId");
  if (
    appId === UNREADABLE ||
    appId === null ||
    !ts.isStringLiteral(appId) ||
    !LITERAL_APP_ID.test(appId.text)
  ) {
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
