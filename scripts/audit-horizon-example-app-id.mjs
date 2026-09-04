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
// A binding that exists but whose value is not its declaration's text.
const OPAQUE = { declaration: null, initialiser: null };

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
const followed = new Set();
const resolve = (node, is, seen = new Set()) => {
  if (!node) return null;
  const bare = unwrap(node);
  if (is(bare)) return bare;
  if (ts.isIdentifier(bare)) {
    if (seen.has(bare)) return null;
    seen.add(bare);
    for (const declaration of bindingChain(bare)) followed.add(declaration);
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
 * The names a statement introduces into the scope that contains it.
 *
 * Only a plain `const x = <expression>` yields a value. Everything else — a
 * `let`, a destructuring pattern, an import, a function, class, enum or
 * namespace declaration — binds the name to something whose value is not the
 * declaration's text, so it resolves to nothing rather than falling through to
 * an outer constant of the same name.
 *
 * A loop or catch binding is NOT here: it belongs to its own body, and counting
 * it as the enclosing block's shadowed a real constant declared beside it.
 */
const declarationsIn = (node) => {
  const bound = new Map();
  const declare = (name, declaration, initialiser) => {
    if (ts.isIdentifier(name)) {
      bound.set(name.text, { declaration, initialiser: initialiser ?? null });
      return;
    }
    // A binding pattern names several things and none of them is this text.
    for (const element of name.elements ?? []) {
      if (element.name) declare(element.name, declaration, null);
    }
  };

  if (ts.isVariableStatement(node)) {
    const constant = Boolean(node.declarationList.flags & ts.NodeFlags.Const);
    for (const declaration of node.declarationList.declarations) {
      declare(
        declaration.name,
        declaration,
        constant ? declaration.initializer : null,
      );
    }
  } else if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)) &&
    node.name
  ) {
    declare(node.name, node, null);
  } else if (ts.isImportDeclaration(node) && node.importClause) {
    if (node.importClause.name) declare(node.importClause.name, node, null);
    for (const element of node.importClause.namedBindings?.elements ?? []) {
      declare(element.name, node, null);
    }
    if (node.importClause.namedBindings?.name) {
      declare(node.importClause.namedBindings.name, node, null);
    }
  }
  return bound;
};

// A loop or catch header binds for its own body only, and never to a value: a
// loop variable takes a new one each iteration, `const` included.
const headerBinds = (scope, name) => {
  const named = (binding) =>
    ts.isIdentifier(binding)
      ? binding.text === name
      : (binding.elements ?? []).some(
          (element) => element.name && named(element.name),
        );
  if (
    (ts.isForStatement(scope) ||
      ts.isForOfStatement(scope) ||
      ts.isForInStatement(scope)) &&
    scope.initializer &&
    ts.isVariableDeclarationList(scope.initializer)
  ) {
    return scope.initializer.declarations.some((one) => named(one.name));
  }
  if (ts.isCatchClause(scope) && scope.variableDeclaration) {
    return named(scope.variableDeclaration.name);
  }
  return false;
};

// A `var` anywhere inside a function belongs to the function, not the block it
// is written in. Treating only the block's own statements as its declarations
// let an outer constant answer for a hoisted name.
const hoistedVar = (scope, name) => {
  let found = false;
  const named = (binding) =>
    ts.isIdentifier(binding)
      ? binding.text === name
      : (binding.elements ?? []).some(
          (element) => element.name && named(element.name),
        );
  const visit = (node) => {
    if (found) return;
    if (ts.isFunctionLike(node) && node !== scope) return;
    const list = ts.isVariableStatement(node)
      ? node.declarationList
      : (ts.isForStatement(node) ||
            ts.isForOfStatement(node) ||
            ts.isForInStatement(node)) &&
          node.initializer &&
          ts.isVariableDeclarationList(node.initializer)
        ? node.initializer
        : null;
    if (
      list &&
      !(list.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) &&
      list.declarations.some((one) => named(one.name))
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(scope, visit);
  return found;
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
const lookup = (identifier) => {
  for (let scope = identifier.parent; scope; scope = scope.parent) {
    // A switch body is one scope across every clause, not one per clause.
    const statements = ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope)
      ? scope.statements
      : ts.isCaseBlock(scope)
        ? scope.clauses.flatMap((clause) => clause.statements)
        : null;
    for (const statement of statements ?? []) {
      const bound = declarationsIn(statement);
      if (bound.has(identifier.text)) return bound.get(identifier.text);
    }
    if (headerBinds(scope, identifier.text)) return OPAQUE;
    if (ts.isFunctionLike(scope)) {
      if (bindsParameter(scope, identifier.text)) return OPAQUE;
      // `var` is function-scoped wherever it is written, so a loop or block
      // inside this function still binds the name out here.
      if (hoistedVar(scope, identifier.text)) return OPAQUE;
    }
    // A named function or class expression binds its own name inside itself.
    if (
      (ts.isFunctionExpression(scope) || ts.isClassExpression(scope)) &&
      scope.name?.text === identifier.text
    ) {
      return OPAQUE;
    }
  }
  return null;
};

const resolveBinding = (identifier) => lookup(identifier)?.initialiser ?? null;

// Every declaration an identifier can stand for, following `const x = y` links.
// Comparing declarations rather than names is what lets a write through an
// alias count, and a same-named parameter elsewhere not count.
const bindingChain = (identifier, seen = new Set()) => {
  const chain = new Set();
  let current = identifier;
  while (current && !seen.has(current)) {
    seen.add(current);
    const found = lookup(current);
    if (!found || found === OPAQUE) break;
    if (found.declaration) chain.add(found.declaration);
    const next = found.initialiser ? unwrap(found.initialiser) : null;
    current = next && ts.isIdentifier(next) ? next : null;
  }
  return chain;
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
 * Everything the exported config can carry, without running anything.
 *
 * A `plugins` array the export cannot reach is a fixture: a stale constant left
 * by a refactor holds a complete entry while the exported config registers
 * nothing. Reachability follows object properties, array elements, spreads,
 * `const` bindings, the values a function returns, and call ARGUMENTS — the
 * real config returns `helper(expoConfig)`, and the entry is inside that
 * argument.
 *
 * Following arguments is deliberately generous: it keeps the boundary this
 * audit already documents — it cannot prove the helper passes `plugins` through
 * — while refusing an object the export never touches.
 */
const reachableFromExport = (source) => {
  // `export default <expr>` is an ExportAssignment; `export default function
  // config() {}` is a declaration carrying a default modifier. Missing the
  // second read a perfectly ordinary config as registering nothing.
  const roots = [];
  const isDefault = (node) =>
    node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    );
  const findExport = (node) => {
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      roots.push(node.expression);
    } else if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      isDefault(node)
    ) {
      roots.push(node);
    } else if (ts.isExportDeclaration(node) && node.exportClause) {
      for (const element of node.exportClause.elements ?? []) {
        if (element.name.text === "default") roots.push(element.propertyName ?? element.name);
      }
    } else if (
      // Expo allows a `.ts` config to use CommonJS.
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === "module" &&
      node.left.name.text === "exports"
    ) {
      roots.push(node.right);
    } else {
      ts.forEachChild(node, findExport);
    }
  };
  findExport(source);

  const reached = new Set();
  const queue = [...roots];
  const enqueue = (node) => {
    if (node) queue.push(node);
  };
  while (queue.length > 0) {
    const node = unwrap(queue.pop());
    if (!node || reached.has(node)) continue;
    reached.add(node);

    if (ts.isIdentifier(node)) enqueue(resolveBinding(node));
    else if (ts.isObjectLiteralExpression(node)) {
      for (const member of node.properties) {
        if (ts.isPropertyAssignment(member)) enqueue(member.initializer);
        else if (ts.isShorthandPropertyAssignment(member)) enqueue(member.name);
        else if (ts.isSpreadAssignment(member)) enqueue(member.expression);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        enqueue(ts.isSpreadElement(element) ? element.expression : element);
      }
    } else if (ts.isCallExpression(node)) {
      for (const argument of node.arguments) enqueue(argument);
    } else if (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isFunctionDeclaration(node)
    ) {
      if (node.body && ts.isBlock(node.body)) {
        const returns = (statement) => {
          if (ts.isReturnStatement(statement)) enqueue(statement.expression);
          // A nested function's returns are its own, not this one's.
          if (!ts.isFunctionLike(statement)) ts.forEachChild(statement, returns);
        };
        ts.forEachChild(node.body, returns);
      } else if (node.body) {
        enqueue(node.body);
      }
    }
  }
  return reached;
};

/**
 * The options the OpenIAP plugin entry names.
 *
 * The tuple has to be a direct element of a `plugins` array the exported config
 * can reach, or a fixture elsewhere stands in for the entry the build receives.
 * Two candidate tuples are an ambiguity this audit reports rather than picks
 * from.
 */
const pluginOptions = (source) => {
  const reachable = reachableFromExport(source);
  const keyed = (name, wanted) => {
    if (!name) return false;
    if (ts.isComputedPropertyName(name)) {
      const computed = unwrap(name.expression);
      return (
        (ts.isStringLiteral(computed) ||
          ts.isNoSubstitutionTemplateLiteral(computed)) &&
        computed.text === wanted
      );
    }
    return name.text === wanted;
  };

  const arrays = [];
  let unreadable = false;
  const findPluginsValue = (node) => {
    if (
      ts.isObjectLiteralExpression(node) &&
      reachable.has(node) &&
      node.properties.some((member) => keyed(member.name, "plugins"))
    ) {
      // A spread after `plugins` replaces it, exactly as one does deeper in
      // the options object.
      let seen = false;
      let replaced = false;
      for (const member of node.properties) {
        if (ts.isSpreadAssignment(member)) {
          if (seen) replaced = true;
          continue;
        }
        if (!keyed(member.name, "plugins")) continue;
        seen = true;
        replaced = false;
        const array = arrayLiteral(
          ts.isPropertyAssignment(member) ? member.initializer : member.name,
        );
        if (array) arrays.push(array);
      }
      if (replaced) unreadable = true;
    }
    ts.forEachChild(node, findPluginsValue);
  };
  findPluginsValue(source);
  if (unreadable) return UNREADABLE;

  // A spread of an array resolves the same way its elements do.
  const elementsOf = (array, open = []) => {
    // `open` is the path being expanded, so a cycle stops while `[...a, ...a]`
    // still yields both — it registers twice at runtime.
    if (open.includes(array)) return [];
    return array.elements.flatMap((element) => {
      if (!ts.isSpreadElement(element)) return [element];
      const inner = arrayLiteral(element.expression);
      return inner ? elementsOf(inner, [...open, array]) : [];
    });
  };

  const found = [];
  for (const array of arrays) {
    for (const element of elementsOf(array)) {
      const tuple = arrayLiteral(element);
      if (!tuple || tuple.elements.length < 2) continue;
      const path = stringValue(tuple.elements[0]);
      if (path !== null && /app\.plugin\.js$/u.test(path)) {
        found.push(tuple.elements[1]);
      }
    }
  }
  if (found.length > 1) return UNREADABLE;
  return found[0];
};

/**
 * Whether the module writes through any of these bindings.
 *
 * `const` binds the name, not the contents: a config can build the right object
 * and then set `options.android.horizon.appId = ""`. Nothing in the scope walk
 * sees that.
 *
 * Bindings are compared by DECLARATION, not by name, so `const alias = options`
 * followed by a write through `alias` counts, while an unrelated parameter
 * called `options` in some helper does not.
 *
 * What this does NOT catch: a config that hands the object to a function that
 * mutates it. Proving that needs escape analysis, and it is documented rather
 * than guessed at.
 */
const OBJECT_MUTATORS = new Set([
  "assign",
  "defineProperty",
  "defineProperties",
  "setPrototypeOf",
  "set",
  "deleteProperty",
]);
const ARRAY_MUTATORS = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);

const writesThrough = (source, bindings) => {
  if (bindings.size === 0) return false;
  const rootOf = (node) => {
    let current = unwrap(node);
    while (
      ts.isPropertyAccessExpression(current) ||
      ts.isElementAccessExpression(current)
    ) {
      current = unwrap(current.expression);
    }
    return ts.isIdentifier(current) ? current : null;
  };
  const tracked = (node) => {
    const root = rootOf(node);
    if (!root) return false;
    for (const declaration of bindingChain(root)) {
      if (bindings.has(declaration)) return true;
    }
    return false;
  };
  // A write target is a property access, or a destructuring pattern holding one.
  const targeted = (node) => {
    const bare = unwrap(node);
    if (
      ts.isPropertyAccessExpression(bare) ||
      ts.isElementAccessExpression(bare)
    ) {
      return tracked(bare);
    }
    if (ts.isObjectLiteralExpression(bare)) {
      return bare.properties.some((member) => {
        if (ts.isPropertyAssignment(member)) return targeted(member.initializer);
        if (ts.isSpreadAssignment(member)) return targeted(member.expression);
        return false;
      });
    }
    if (ts.isArrayLiteralExpression(bare)) {
      return bare.elements.some((element) =>
        targeted(ts.isSpreadElement(element) ? element.expression : element),
      );
    }
    return false;
  };

  let writes = false;
  const visit = (node) => {
    if (writes) return;
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      targeted(node.left)
    ) {
      writes = true;
    } else if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      targeted(node.operand)
    ) {
      writes = true;
    } else if (ts.isDeleteExpression(node) && targeted(node.expression)) {
      writes = true;
    } else if (
      (ts.isForOfStatement(node) || ts.isForInStatement(node)) &&
      node.initializer &&
      !ts.isVariableDeclarationList(node.initializer) &&
      targeted(node.initializer)
    ) {
      writes = true;
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text;
      const receiver = unwrap(node.expression.expression);
      const builtin =
        ts.isIdentifier(receiver) &&
        (receiver.text === "Object" || receiver.text === "Reflect");
      // Only the TARGET of Object.assign/Reflect.set is written; the rest are
      // sources. `Object.assign({}, options)` copies out of ours.
      if (builtin && OBJECT_MUTATORS.has(method)) {
        const target = node.arguments[0];
        if (target && (tracked(target) || targeted(target))) writes = true;
      } else if (ARRAY_MUTATORS.has(method) && tracked(receiver)) {
        writes = true;
      }
    }
    if (!writes) ts.forEachChild(node, visit);
  };
  visit(source);
  return writes;
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

  followed.clear();
  const entry = pluginOptions(source);
  if (entry === UNREADABLE) {
    return "does not resolve to one OpenIAP plugin entry — it registers more than one, or a spread could replace the plugins array";
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
  // The literal is only what the build receives if nothing wrote through the
  // bindings this walk followed to reach it.
  if (writesThrough(source, followed)) {
    return "writes through the bindings that carry the app id, so the literal above is not what the plugin receives";
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
