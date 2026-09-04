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

// Wrappers that do not change the value at runtime.
const unwrap = (node) =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isTypeAssertionExpression(node) ||
  ts.isNonNullExpression(node)
    ? unwrap(node.expression)
    : node;

// Follow an expression to a node of the wanted kind, through those wrappers and
// through `const` bindings.
const resolve = (node, is, seen = new Set()) => {
  if (!node) return null;
  const bare = unwrap(node);
  if (is(bare)) return bare;
  if (ts.isIdentifier(bare)) {
    if (seen.has(bare)) return null;
    seen.add(bare);
    return resolve(resolveBinding(bare), is, seen);
  }
  return null;
};

const objectLiteral = (node) => resolve(node, ts.isObjectLiteralExpression);
const arrayLiteral = (node) => resolve(node, ts.isArrayLiteralExpression);
// A template with no substitutions has a definite value; one with them does not.
const stringValue = (node) => {
  const literal = resolve(
    node,
    (candidate) =>
      ts.isStringLiteral(candidate) ||
      ts.isNoSubstitutionTemplateLiteral(candidate),
  );
  return literal === null ? null : literal.text;
};

/**
 * The names a node introduces into the scope it belongs to.
 *
 * Only a plain `const x = <expression>` yields a value. Everything else — a
 * `let`, a loop or catch binding, a destructuring pattern, a parameter, an
 * import, a function or class declaration — binds the name to something whose
 * value is not the declaration's text, so it resolves to nothing rather than
 * falling through to an outer constant of the same name.
 */
const bindingsIn = (node) => {
  const bound = new Map();
  const declare = (name, initialiser) => {
    if (ts.isIdentifier(name)) {
      bound.set(name.text, initialiser ?? null);
      return;
    }
    // A binding pattern names several things and none of them is this text.
    for (const element of name.elements ?? []) {
      if (element.name) declare(element.name, null);
    }
  };
  const fromList = (list, constant) => {
    for (const declaration of list.declarations) {
      declare(declaration.name, constant ? declaration.initializer : null);
    }
  };

  if (ts.isVariableStatement(node)) {
    fromList(
      node.declarationList,
      Boolean(node.declarationList.flags & ts.NodeFlags.Const),
    );
  } else if (
    (ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node)) &&
    node.initializer &&
    ts.isVariableDeclarationList(node.initializer)
  ) {
    // A loop binding takes a new value each iteration, `const` included.
    fromList(node.initializer, false);
  } else if (ts.isCatchClause(node) && node.variableDeclaration) {
    declare(node.variableDeclaration.name, null);
  } else if (
    (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
    node.name
  ) {
    declare(node.name, null);
  } else if (ts.isImportDeclaration(node) && node.importClause) {
    if (node.importClause.name) declare(node.importClause.name, null);
    for (const element of node.importClause.namedBindings?.elements ?? []) {
      declare(element.name, null);
    }
    if (node.importClause.namedBindings?.name) {
      declare(node.importClause.namedBindings.name, null);
    }
  }
  return bound;
};

// A parameter is never a value read from its declaration, so it only has to be
// recognised as a shadow.
const bindsParameter = (scope, name) => {
  const named = (binding) =>
    ts.isIdentifier(binding)
      ? binding.text === name
      : (binding.elements ?? []).some(
          (element) => element.name && named(element.name),
        );
  return (scope.parameters ?? []).some((parameter) => named(parameter.name));
};

/**
 * The initialiser an identifier resolves to, or null.
 *
 * Scope is resolved the way the language does — the innermost enclosing scope
 * that binds the name wins — so a same-named binding in an unrelated function
 * is a different variable, and a parameter, loop variable or catch binding
 * shadows anything outside it.
 */
const resolveBinding = (identifier) => {
  for (let scope = identifier.parent; scope; scope = scope.parent) {
    const statements = ts.isSourceFile(scope)
      ? scope.statements
      : ts.isBlock(scope) || ts.isModuleBlock(scope) || ts.isCaseClause(scope)
        ? scope.statements
        : null;
    for (const statement of statements ?? []) {
      const bound = bindingsIn(statement);
      if (bound.has(identifier.text)) return bound.get(identifier.text);
    }
    // A loop or catch header binds for its own body.
    const header = bindingsIn(scope);
    if (header.has(identifier.text)) return header.get(identifier.text);
    if (ts.isFunctionLike(scope) && bindsParameter(scope, identifier.text)) {
      return null;
    }
  }
  return null;
};

/**
 * The winning value of a property, UNREADABLE when the object is composed in a
 * way this audit does not model, or null when the key is absent.
 *
 * The last assignment of a key wins, matching the language. A spread or a
 * computed key that follows it can replace it, and deciding whether it does
 * means resolving its source — but a later explicit assignment wins over both,
 * so the check is positional rather than blanket.
 */
const property = (object, name) => {
  let value = null;
  let shadowed = false;
  for (const member of object.properties) {
    if (ts.isSpreadAssignment(member) || ts.isComputedPropertyName(member.name)) {
      shadowed = true;
      continue;
    }
    if (!member.name) continue;
    // `name.text` is the DECODED property name, so `"appId"` is `appId`.
    if (member.name.text !== name) continue;
    if (ts.isPropertyAssignment(member)) value = member.initializer;
    else if (ts.isShorthandPropertyAssignment(member)) value = member.name;
    else return UNREADABLE;
    shadowed = false;
  }
  return shadowed ? UNREADABLE : value;
};

/**
 * The options the OpenIAP plugin entry names.
 *
 * The tuple has to be reached through a `plugins` value, or an unused fixture
 * elsewhere in the module stands in for the entry the build receives. Two
 * candidate tuples are an ambiguity this audit reports rather than picks from.
 */
const pluginOptions = (source) => {
  const arrays = [];
  const findPluginsValue = (node) => {
    if (
      (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
      node.name &&
      !ts.isComputedPropertyName(node.name) &&
      node.name.text === "plugins"
    ) {
      const array = arrayLiteral(
        ts.isPropertyAssignment(node) ? node.initializer : node.name,
      );
      if (array) arrays.push(array);
    }
    ts.forEachChild(node, findPluginsValue);
  };
  findPluginsValue(source);

  const found = [];
  const findEntry = (node) => {
    if (ts.isArrayLiteralExpression(node) && node.elements.length >= 2) {
      const entry = unwrap(node.elements[0]);
      if (
        (ts.isStringLiteral(entry) ||
          ts.isNoSubstitutionTemplateLiteral(entry)) &&
        /app\.plugin\.js$/u.test(entry.text)
      ) {
        found.push(node.elements[1]);
        return;
      }
    }
    ts.forEachChild(node, findEntry);
  };
  for (const array of arrays) findEntry(array);
  if (found.length > 1) return UNREADABLE;
  return found[0];
};

const inspectExpoPluginConfig = (contents) => {
  const source = ts.createSourceFile(
    "app.config.ts",
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  // The parser recovers from a syntax error and hands back a tree anyway, so a
  // truncated config would read as a well-formed one that happens to declare
  // the id. Refusing it is the same rule the XML reader follows.
  if (source.parseDiagnostics?.length) {
    return "does not parse, so no app id can be read from it";
  }

  const entry = pluginOptions(source);
  if (entry === UNREADABLE) {
    return "registers the OpenIAP config plugin more than once, so which options the build receives is not readable here";
  }
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
    const where = key === "android" ? "the plugin options" : "android";
    const value = property(block, key);
    if (value === UNREADABLE) {
      return `composes ${where} in a way this audit cannot read; write the Horizon app id as a plain literal`;
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
  const literal =
    appId === UNREADABLE || appId === null ? null : stringValue(appId);
  if (literal === null || !LITERAL_APP_ID.test(literal)) {
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
