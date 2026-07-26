#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSchemaDeprecations } from "../packages/gql/schema-deprecations.mjs";
import { SCHEMA_FILE_NAMES } from "../packages/gql/schema-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPENIAP_3_REMOVAL_NOTICE = "Scheduled for removal in OpenIAP 3.0.";

const scanRules = [
  {
    label: "openiap-apple",
    roots: ["packages/apple/Sources"],
    extensions: [".swift"],
    marker: "@available(*, deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    excludedNames: new Set(["Types.swift"]),
  },
  {
    label: "openiap-google",
    roots: ["packages/google/openiap/src"],
    extensions: [".kt"],
    marker: "@Deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    excludedNames: new Set(["Types.kt"]),
  },
  {
    label: "react-native-iap",
    roots: ["libraries/react-native-iap/src"],
    extensions: [".ts", ".tsx"],
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    excludedNames: new Set(["types.ts"]),
  },
  {
    label: "expo-iap",
    roots: ["libraries/expo-iap/src", "libraries/expo-iap/plugin/src"],
    extensions: [".ts", ".tsx"],
    marker: "@deprecated",
    notice: "expo-iap 5.0.0",
    excludedNames: new Set(["types.ts"]),
  },
  {
    label: "flutter_inapp_purchase",
    roots: ["libraries/flutter_inapp_purchase/lib"],
    extensions: [".dart"],
    marker: "@Deprecated",
    notice: "flutter_inapp_purchase 10.0.0",
    excludedNames: new Set(["types.dart"]),
  },
  {
    label: "godot-iap GDScript",
    roots: ["libraries/godot-iap/addons/godot-iap"],
    extensions: [".gd"],
    marker: "## @deprecated",
    notice: "godot-iap 3.0.0",
    excludedNames: new Set(["types.gd"]),
  },
  {
    label: "godot-iap Swift",
    roots: ["libraries/godot-iap/ios-gdextension/Sources"],
    extensions: [".swift"],
    marker: "@available(*, deprecated",
    notice: "godot-iap 3.0.0",
    excludedNames: new Set(),
  },
  {
    label: "kmp-iap",
    roots: ["libraries/kmp-iap/library/src"],
    extensions: [".kt"],
    marker: "@Deprecated",
    notice: "kmp-iap 3.0.0",
    excludedNames: new Set(["Types.kt"]),
  },
  {
    label: "OpenIap.Maui",
    roots: ["libraries/maui-iap/src"],
    extensions: [".cs"],
    marker: "[Obsolete(",
    notice: "OpenIap.Maui 2.0.0",
    excludedNames: new Set(["Types.cs"]),
  },
];

const requiredSourceNotices = [
  {
    file: "knowledge/internal/07-docs-consistency.md",
    values: [
      "Scheduled for removal in OpenIAP 3.0.",
      "`react-native-iap` 16.0.0",
      "`expo-iap` 5.0.0",
      "`flutter_inapp_purchase` 10.0.0",
      "`godot-iap` 3.0.0",
      "`kmp-iap` 3.0.0",
      "`OpenIap.Maui` 2.0.0",
      "/docs/updates/deprecations",
      "legacy top-level `{ sku }` verification input",
      "flattened IAPKit verification keys",
      "real `@Deprecated` annotations",
      "bridge aliases such as",
      "internal React Native",
      "Expo Android custom",
      "`skuArr` to `skus`",
      "`offerTokenArr`",
      "KMP iOS product-response normalizer",
      "not scheduled",
      "KMP 3.0",
      "`skuArr` / `productIds`",
      "finish-transaction `transactionIdentifier` with `transactionId`",
      "Android deep-link callers move `sku` /",
      "Raw map/object compatibility adapters use own-key presence semantics",
      "Generated typed platform requests use nullable value semantics",
    ],
  },
  {
    file: "packages/docs/src/lib/images.ts",
    values: [
      "deprecatedApiRemovalVersion: '16.0.0'",
      "deprecatedApiRemovalVersion: '5.0.0'",
      "deprecatedApiRemovalVersion: '10.0.0'",
      "deprecatedApiRemovalVersion: '3.0.0'",
      "deprecatedApiRemovalVersion: '2.0.0'",
    ],
  },
  {
    file: "packages/docs/src/pages/docs/updates/deprecations.tsx",
    values: [
      "Scheduled for removal in OpenIAP 3.0.",
      "react-native-iap 16.0.0",
      "expo-iap 5.0.0",
      "flutter_inapp_purchase 10.0.0",
      "godot-iap 3.0.0",
      "kmp-iap 3.0.0",
      "OpenIap.Maui 2.0.0",
      "originalJsonAndroid",
      "dataAndroid",
      "purchaseStateAndroid",
      "transactionStateIOS",
      "transactionReceipt",
      "id used as a transactionId fallback",
      "top-level { sku } for verifyPurchase / validateReceiptIOS",
      "flattened verify_purchase_with_provider IAPKit keys",
      "OpenIapLog.d / i / w / e",
      "short requestSubscriptionWithSku(_:offer:completion:) overload",
      "raw/custom purchase id used as a transactionId fallback",
      "getAppTransactionIOS",
      "subscriptionStatusIOS",
      "flutterCustomWireMigrations",
      "Android native requestPurchaseJson",
      "generated RequestPurchaseProps.useAlternativeBilling",
      "data-class named",
      "constructor argument does not trigger its property annotation",
      "Android custom-channel skuArr",
      "Android custom-channel offerTokenArr",
      "fetchProducts skuArr / productIds",
      "finishTransaction transactionIdentifier",
      "Android deep-link sku / packageName",
      "Raw map/object compatibility inputs",
      "Generated Swift and Kotlin request models expose nullable",
    ],
  },
  {
    file: "scripts/agent/compile-context.ts",
    values: [
      "## Deprecations and major-version migration",
      "`react-native-iap\\` 16.0.0",
      "`expo-iap\\` 5.0.0",
      "`flutter_inapp_purchase\\` 10.0.0",
      "`godot-iap\\` 3.0.0",
      "`kmp-iap\\` 3.0.0",
      "`OpenIap.Maui\\` 2.0.0",
      "originalJsonAndroid -> dataAndroid",
      "purchaseStateAndroid / transactionStateIOS -> purchaseState",
      "transactionReceipt -> purchaseToken",
      "id used as a transactionId fallback",
      "legacy top-level \\`{sku}\\`",
      "verification input also ends in 10.0.0",
      "Godot 3 removes flattened IAPKit verification keys",
      "generated Kotlin declarations",
      "Dart calls emit canonical",
      "request.ios/android",
      "request.apple/google",
      "Expo custom Android callers",
      "skuArr -> skus",
      "offerTokenArr -> subscriptionOffers",
      "Flutter custom Android callers",
      "offerTokenArr -> offerToken",
      "OpenIapLog.d/i/w/e",
      "internal native-response",
      "skuArr/productIds -> skus",
      "sku/packageName -> skuAndroid/packageNameAndroid",
      "finish-transaction \\`transactionIdentifier\\` with",
      "Raw map/object compatibility inputs",
      "typed facades prefer a",
    ],
  },
  {
    file: "packages/docs/src/pages/docs/updates/releases.tsx",
    values: [
      "IAPKit security and SDK patch train",
      "OpenIAP Spec 2.4.4",
      "openiap-apple 2.4.4",
      "openiap-google 2.5.1",
      "react-native-iap 15.6.1",
      "expo-iap 4.7.1",
      "flutter_inapp_purchase 9.6.1",
      "godot-iap 2.6.1",
      "kmp-iap 2.7.1",
      "OpenIap.Maui 1.4.1",
      "fetchProducts skuArr / productIds",
      "transactionIdentifier",
      "Android deep-link sku / packageName",
      "Raw map/object compatibility inputs",
      "typed facades prefer a non-null",
    ],
  },
  ...[
    "packages/docs/public/llms.txt",
    "packages/docs/public/llms-full.txt",
  ].map((file) => ({
    file,
    values: [
      "Deprecations and major-version migration",
      "OpenIAP 3.0",
      "react-native-iap` 16.0.0",
      "expo-iap` 5.0.0",
      "flutter_inapp_purchase` 10.0.0",
      "godot-iap` 3.0.0",
      "kmp-iap` 3.0.0",
      "OpenIap.Maui` 2.0.0",
      "originalJsonAndroid -> dataAndroid",
      "purchaseStateAndroid / transactionStateIOS -> purchaseState",
      "transactionReceipt -> purchaseToken",
      "id used as a transactionId fallback",
      "legacy top-level `{sku}`",
      "verification input also ends in 10.0.0",
      "Godot 3 removes flattened IAPKit verification keys",
      "generated Kotlin declarations",
      "Dart calls emit canonical",
      "OpenIapLog.d/i/w/e",
      "internal native-response",
      "https://openiap.dev/docs/updates/deprecations",
      "skuArr/productIds -> skus",
      "sku/packageName -> skuAndroid/packageNameAndroid",
      "finish-transaction `transactionIdentifier` with",
      "Raw map/object compatibility inputs",
      "typed facades prefer a",
    ],
  })),
  {
    file: "knowledge/_claude-context/context.md",
    values: [
      "R13 — Deprecations state one removal boundary",
      "OpenIAP 3.0",
      "`react-native-iap` 16.0.0",
      "`expo-iap` 5.0.0",
      "`flutter_inapp_purchase` 10.0.0",
      "`godot-iap` 3.0.0",
      "`kmp-iap` 3.0.0",
      "`OpenIap.Maui` 2.0.0",
      "`originalJsonAndroid` → `dataAndroid`",
      "`purchaseStateAndroid` /",
      "`transactionStateIOS` → `purchaseState`",
      "`transactionReceipt` →",
      "`purchaseToken`, and `id` as a fallback for `transactionId`",
      "legacy top-level `{ sku }` verification input",
      "Godot's flattened IAPKit verification keys",
      "real `@Deprecated` annotations",
      "bridge aliases such as",
      "internal React Native",
      "/docs/updates/deprecations",
      "`skuArr` / `productIds`",
      "finish-transaction `transactionIdentifier` with `transactionId`",
      "Android deep-link callers move `sku` /",
      "Raw map/object compatibility adapters use own-key presence semantics",
      "Generated typed platform requests use nullable value semantics",
    ],
  },
  {
    file: "packages/gql/codegen/plugins/kotlin.ts",
    values: [
      '@file:Suppress("DEPRECATION", "UNCHECKED_CAST")',
      "private deprecationReason(",
      "private deprecationAnnotation(",
      "private generateDeprecationAnnotation(",
      "ReplaceWith",
    ],
  },
  ...[
    "packages/gql/src/generated/Types.kt",
    "packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt",
    "libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt",
  ].map((file) => ({
    file,
    values: [
      '@file:Suppress("DEPRECATION", "UNCHECKED_CAST")',
      '@Deprecated("Use google instead. Scheduled for removal in OpenIAP 3.0.", ReplaceWith("google"))',
      '@Deprecated("Use apple instead. Scheduled for removal in OpenIAP 3.0.", ReplaceWith("apple"))',
      '@Deprecated("Use enableBillingProgramAndroid instead. Scheduled for removal in OpenIAP 3.0.", ReplaceWith("enableBillingProgramAndroid"))',
    ],
  })),
  {
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/OpenIapLog.kt",
    values: [
      "Use debug instead. Scheduled for removal in OpenIAP 3.0.",
      "Use info instead. Scheduled for removal in OpenIAP 3.0.",
      "Use warn instead. Scheduled for removal in OpenIAP 3.0.",
      "Use error instead. Scheduled for removal in OpenIAP 3.0.",
    ],
  },
  {
    file: "packages/apple/Sources/OpenIapModule+ObjC.swift",
    values: [
      "Use the extended overload",
      "Scheduled for removal in OpenIAP 3.0.",
    ],
  },
  {
    file: "packages/apple/Sources/Models/OpenIapSerialization.swift",
    values: [
      "OpenIapLog.deprecation(",
      "Custom bridges must emit `transactionId` explicitly before OpenIAP",
      "will be rejected in OpenIAP 3.0",
      'normalizedDict["transactionId"] == nil',
      'normalizedDict["id"]',
    ],
  },
  {
    file: "libraries/flutter_inapp_purchase/lib/helpers.dart",
    values: [
      "legacyKey: 'purchaseStateAndroid'",
      "warningKey: 'purchase.purchaseStateAndroid'",
      "legacyKey: 'transactionStateIOS'",
      "warningKey: 'purchase.transactionStateIOS'",
      "legacyKey: 'transactionReceipt'",
      "warningKey: 'purchase.transactionReceipt'",
      "legacyKey: 'originalJsonAndroid'",
      "warningKey: 'purchase.originalJsonAndroid'",
      "`subscriptionOffers` instead.",
      "`subscriptionGroupIdIOS` for the group identifier instead.",
      "`id` transaction fallback ends in 10.0.0",
      "warnLegacyOnce(",
      "flutter_inapp_purchase 10.0.0",
    ],
  },
  ...[
    "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
    "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
  ].map((file) => ({
    file,
    values: [
      "FlutterIapLog.deprecation(",
      "Top-level `sku` verification input is deprecated",
      "flutter_inapp_purchase 10.0.0",
      "`apple.sku`",
    ],
  })),
  ...[
    "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterIapLog.swift",
    "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterIapLog.swift",
  ].map((file) => ({
    file,
    values: [
      "always-visible warning for compatibility scheduled for removal",
      "static func deprecation(_ message: String) {",
      "deprecation(message, message)",
    ],
  })),
  {
    file: "libraries/godot-iap/addons/godot-iap/godot_iap.gd",
    values: [
      "godot-iap 3.0.0",
      "nest those keys under `iapkit`",
      "_normalize_verify_purchase_with_provider_props",
      'normalized.has("iapkit")',
      '"flattened IAPKit verification keys"',
    ],
  },
  {
    file: "libraries/godot-iap/android/src/main/java/dev/hyo/godotiap/GodotIap.kt",
    values: [
      "Flattened IAPKit verification keys are deprecated",
      "godot-iap 3.0.0",
      "Nest them under",
      "`iapkit`",
      'props.containsKey("iapkit")',
    ],
  },
  {
    file: "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
    values: [
      "scheduled for removal in flutter_inapp_purchase 10.0.0",
      'resolveCanonicalOrLegacy("skus", "skuArr")',
      '"obfuscatedAccountIdAndroid"',
      '"obfuscatedProfileIdAndroid"',
      'resolveCanonicalOrLegacy("purchaseToken", "purchaseTokenAndroid")',
      '"requestPurchase.offerTokenArr.in-app"',
      '"requestPurchase.offerTokenArr.subs"',
      "Use `subscriptionProductReplacementParams` instead",
      "Use `InitConnectionConfig.enableBillingProgramAndroid` instead",
    ],
  },
  {
    file: "libraries/expo-iap/android/src/main/java/expo/modules/iap/ExpoIapHelper.kt",
    values: [
      '"request-purchase.skuArr"',
      "Use `skus` instead.",
      '"request-purchase.offerTokenArr"',
      "Use `subscriptionOffers` instead.",
    ],
  },
  {
    file: "libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/ProductPayloadNormalizerIOS.kt",
    values: [
      "internal StoreKit bridge-response recovery",
      "not a user-authored",
      "KMP 3.0 public API removal schedule",
    ],
  },
  {
    file: ".github/workflows/ci-godot-iap.yml",
    values: [
      "testDebugUnitTest",
      "name: Swift Test",
      "working-directory: libraries/godot-iap/ios-gdextension",
      "run: swift test",
    ],
  },
  {
    file: "libraries/expo-iap/plugin/src/expoConfig.augmentation.d.ts",
    values: [
      "fireOS?: boolean",
      "VegaProjectOptions | boolean",
      "boolean value is a deprecated module-selection input",
      "expo-iap 5.0.0",
    ],
  },
  {
    file: "libraries/expo-iap/plugin/src/withIAP.ts",
    values: [
      "android.amazon.fireOS is deprecated",
      "boolean form of android.amazon.vegaOS is deprecated",
      "expo-iap 5.0.0",
    ],
  },
  {
    file: "libraries/expo-iap/plugin/__tests__/withIAP.test.ts",
    values: [
      "typedLegacyAmazonOptions",
      "fireOS: true",
      "vegaOS: false",
      "warns for legacy Android plugin fields scheduled for 5.0 removal",
    ],
  },
  {
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt",
    values: [
      "loadHorizonModule(context)",
      "loadAmazonModule(context)",
      "loadPlayModule(context)",
      "clazz.getConstructor(Context::class.java)",
    ],
  },
  {
    file: "packages/google/ALTERNATIVE_BILLING.md",
    values: [
      "OpenIapStore(applicationContext)",
      "enableBillingProgramAndroid",
      "OpenIAP 3.0",
      "/docs/updates/deprecations",
    ],
  },
  {
    file: "packages/docs/src/pages/docs/setup/store/horizon.tsx",
    values: [
      "com.meta.horizon.platform.HORIZON_APP_ID",
      "com.meta.horizon.platform.ovr.OCULUS_APP_ID",
      "com.meta.horizon.platform.ovr.HORIZON_APP_ID",
      "OpenIAP 3.0",
      "/docs/updates/deprecations#removal-schedule",
    ],
  },
];

export function collectMissingRequiredSourceNotices(file, source) {
  return requiredSourceNotices
    .filter((requirement) => requirement.file === file)
    .flatMap((requirement) =>
      requirement.values.filter((value) => !source.includes(value)),
    );
}

function clonePatternWithoutState(pattern) {
  return new RegExp(pattern.source, pattern.flags.replaceAll("g", ""));
}

function isRegexLiteralStart(source, index) {
  let previous = index - 1;
  while (previous >= 0 && /\s/.test(source[previous])) previous -= 1;
  return previous < 0 || /[=(:,![{;?&|+\-*%^~<>]/.test(source[previous]);
}

function maskLexicalNoise(source, { maskStrings }) {
  let result = "";
  let quote = null;
  let regexLiteral = false;
  let regexCharacterClass = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        result += "\n";
      } else {
        result += " ";
      }
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        result += "  ";
        blockComment = false;
        index += 1;
      } else {
        result += character === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (quote !== null) {
      result += maskStrings ? (character === "\n" ? "\n" : " ") : character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (regexLiteral) {
      result += character === "\n" ? "\n" : " ";
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "[") {
        regexCharacterClass = true;
      } else if (character === "]") {
        regexCharacterClass = false;
      } else if (character === "/" && !regexCharacterClass) {
        regexLiteral = false;
      }
      continue;
    }
    if (character === "/" && next === "/") {
      result += "  ";
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      result += "  ";
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && isRegexLiteralStart(source, index)) {
      regexLiteral = true;
      regexCharacterClass = false;
      result += " ";
      continue;
    }
    result += character;
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      if (maskStrings) result = `${result.slice(0, -1)} `;
    }
  }

  return result;
}

function maskSourceNonCode(source) {
  return maskLexicalNoise(source, { maskStrings: true });
}

/**
 * Extracts a declaration body while ignoring fake signatures and braces in
 * comments, strings, and regular-expression literals.
 */
export function extractBraceDelimitedRegion(source, anchor) {
  const code = maskSourceNonCode(source);
  const match = clonePatternWithoutState(anchor).exec(code);
  if (!match || match.index === undefined) return null;
  const matchedBrace = match[0].lastIndexOf("{");
  const openIndex =
    matchedBrace >= 0
      ? match.index + matchedBrace
      : code.indexOf("{", match.index + match[0].length);
  if (openIndex < 0) return null;

  let depth = 0;
  for (let index = openIndex; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    if (code[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(openIndex, index + 1);
  }
  return null;
}

export function maskSourceComments(source) {
  return maskLexicalNoise(source, { maskStrings: false });
}

function normalizeSourceForStructuralMatching(source) {
  const commentsMasked = maskSourceComments(source);
  let result = "";
  let quote = null;
  let escaped = false;

  for (let index = 0; index < commentsMasked.length; index += 1) {
    const character = commentsMasked[index];
    if (quote === null) {
      result += character;
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      }
      continue;
    }

    if (escaped) {
      result += /[A-Za-z0-9_.-]/.test(character) ? character : " ";
      escaped = false;
      continue;
    }
    if (character === "\\") {
      result += " ";
      escaped = true;
      continue;
    }
    if (character === quote) {
      result += character;
      quote = null;
      continue;
    }
    result += /[A-Za-z0-9_.-]/.test(character) ? character : " ";
  }

  return result;
}

const quotedKeyPattern = (key) =>
  `(?:["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'])`;

function structuralPresencePatterns(key) {
  const literal = quotedKeyPattern(key);
  return [
    new RegExp(`\\.containsKey\\s*\\(\\s*${literal}\\s*\\)`, "g"),
    new RegExp(`\\.keys\\.contains\\s*\\(\\s*${literal}\\s*\\)`, "g"),
    new RegExp(`\\.has\\s*\\(\\s*${literal}\\s*\\)`, "g"),
    new RegExp(
      `(?:Object\\.prototype\\.)?hasOwnProperty\\.call\\s*\\([^,]+,\\s*${literal}\\s*\\)`,
      "g",
    ),
    new RegExp(`\\bhasOwnKey\\s*\\([^,]+,\\s*${literal}\\s*\\)`, "g"),
    new RegExp(`${literal}\\s+in\\s+[A-Za-z_$][\\w$]*`, "g"),
  ];
}

function assignedPresenceIdentifier(source, matchIndex) {
  const prefix = source.slice(Math.max(0, matchIndex - 320), matchIndex);
  const assignments = [
    ...prefix.matchAll(
      /\b(?:const|let|var|final|val)\s+([A-Za-z_$][\w$]*)\s*=/g,
    ),
  ];
  const latest = assignments.at(-1);
  if (!latest?.[1]) return null;
  const assignmentIndex = Math.max(0, matchIndex - 320) + (latest.index ?? 0);
  if (source.slice(assignmentIndex, matchIndex).includes(";")) return null;
  return latest[1];
}

function presenceControlsSelection(source, matchIndex, matchLength) {
  const prefix = source.slice(Math.max(0, matchIndex - 240), matchIndex);
  const suffix = source.slice(matchIndex + matchLength, matchIndex + 1200);
  if (/\bif\s*\([^)]*$/.test(prefix) || /\bif\s+!?[^;\n]*$/.test(prefix)) {
    return true;
  }
  if (/^\s*(?:\?|->)/.test(suffix)) return true;

  const identifier = assignedPresenceIdentifier(source, matchIndex);
  if (!identifier) return false;
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    new RegExp(`\\bif\\s*\\(\\s*!?\\s*${escaped}\\b`),
    new RegExp(`\\bif\\s+!?\\s*${escaped}\\b`),
    new RegExp(`\\b${escaped}\\s*\\?`),
    new RegExp(`\\bhasSelectedState\\s*:\\s*${escaped}\\b`),
    new RegExp(`\\bhasCanonicalTransactionId\\s*:\\s*${escaped}\\b`),
  ].some((pattern) => pattern.test(suffix));
}

export function hasStructuralKeyPresence(source, key) {
  return structuralPresencePatterns(key).some((pattern) =>
    [...source.matchAll(pattern)].some((match) =>
      presenceControlsSelection(
        source,
        match.index ?? 0,
        match[0]?.length ?? 0,
      ),
    ),
  );
}

function hasGovernedKeySelection(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyRead = new RegExp(
    `(?:\\[\\s*${quotedKeyPattern(key)}\\s*\\]|\\.get\\s*\\(\\s*${quotedKeyPattern(key)}\\s*\\)|\\??\\.${escapedKey}\\b)`,
  );

  return structuralPresencePatterns(key).some((pattern) =>
    [...source.matchAll(pattern)].some((match) => {
      const matchIndex = match.index ?? 0;
      const matchEnd = matchIndex + (match[0]?.length ?? 0);
      const immediateSuffix = source.slice(matchEnd, matchEnd + 420);
      if (/^\s*(?:\?|->)/.test(immediateSuffix)) {
        return keyRead.test(immediateSuffix);
      }

      const identifier = assignedPresenceIdentifier(source, matchIndex);
      if (identifier) {
        const escapedIdentifier = identifier.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        const conditional = new RegExp(
          `(?:\\bif\\s*\\(\\s*!?\\s*${escapedIdentifier}\\b[^)]*\\)|\\bif\\s+!?\\s*${escapedIdentifier}\\b|\\b${escapedIdentifier}\\s*\\?)`,
          "g",
        );
        for (const use of source.slice(matchEnd).matchAll(conditional)) {
          const useIndex = matchEnd + (use.index ?? 0);
          const afterCondition = source.slice(
            useIndex + (use[0]?.length ?? 0),
            useIndex + 520,
          );
          const branchStart = afterCondition.search(/\S/);
          if (branchStart < 0) continue;
          if (afterCondition[branchStart] === "{") {
            let depth = 0;
            for (
              let index = branchStart;
              index < afterCondition.length;
              index += 1
            ) {
              if (afterCondition[index] === "{") depth += 1;
              if (afterCondition[index] !== "}") continue;
              depth -= 1;
              if (depth === 0) {
                if (
                  keyRead.test(afterCondition.slice(branchStart, index + 1))
                ) {
                  return true;
                }
                break;
              }
            }
            continue;
          }
          const branchEnd = afterCondition.search(/\belse\b|[:;\n]/);
          const branch = afterCondition.slice(
            branchStart,
            branchEnd < 0 ? 420 : branchEnd,
          );
          if (keyRead.test(branch)) return true;
        }
        return false;
      }

      const prefix = source.slice(Math.max(0, matchIndex - 240), matchIndex);
      if (
        !/\bif\s*\([^)]*$/.test(prefix) &&
        !/\bif\s+!?[^;\n]*$/.test(prefix) &&
        !/^\s*\?/.test(source.slice(matchEnd, matchEnd + 40))
      ) {
        return false;
      }
      return keyRead.test(source.slice(matchEnd, matchEnd + 420));
    }),
  );
}

function dynamicPresenceIdentifiers(source) {
  const identifiers = new Set();
  const patterns = [
    /\.containsKey\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g,
    /\.has\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g,
    /(?:Object\.prototype\.)?hasOwnProperty\.call\s*\([^,]+,\s*([A-Za-z_$][\w$]*)\s*\)/g,
    /\bhasOwnKey\s*\([^,]+,\s*([A-Za-z_$][\w$]*)\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const identifier = match[1];
      if (
        identifier &&
        presenceControlsSelection(
          source,
          match.index ?? 0,
          match[0]?.length ?? 0,
        ) &&
        new RegExp(
          `\\[\\s*${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\]`,
        ).test(source)
      ) {
        identifiers.add(identifier);
      }
    }
  }
  return identifiers;
}

const canonicalSelectorPattern = (canonicalKey, legacyKey) =>
  new RegExp(
    `selectCanonicalPlatformRequest(?:\\s*<[^;]{0,240}?>)?\\s*\\([^;]{0,240}?${quotedKeyPattern(canonicalKey)}\\s*,\\s*${quotedKeyPattern(legacyKey)}\\s*,?\\s*\\)`,
  );

const F = {
  flutter: "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
  flutterHelpers: "libraries/flutter_inapp_purchase/lib/helpers.dart",
  flutterErrors: "libraries/flutter_inapp_purchase/lib/errors.dart",
  flutterAndroid:
    "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
  godotIOS:
    "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIapHelper.swift",
  rn: "libraries/react-native-iap/src/index.ts",
  rnKepler: "libraries/react-native-iap/src/index.kepler.ts",
  rnVega: "libraries/react-native-iap/src/vega-adapter.ts",
  rnShared: "libraries/react-native-iap/src/utils/platform-request.ts",
  rnAndroid:
    "libraries/react-native-iap/android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt",
  rnAndroidLog:
    "libraries/react-native-iap/android/src/main/java/com/margelo/nitro/iap/RnIapLog.kt",
  rnIOS: "libraries/react-native-iap/ios/HybridRnIap.swift",
  rnIOSLog: "libraries/react-native-iap/ios/RnIapLog.swift",
  expo: "libraries/expo-iap/src/index.ts",
  expoKepler: "libraries/expo-iap/src/index.kepler.ts",
  expoAndroid:
    "libraries/expo-iap/android/src/main/java/expo/modules/iap/ExpoIapHelper.kt",
  expoAndroidModule:
    "libraries/expo-iap/android/src/main/java/expo/modules/iap/ExpoIapModule.kt",
  expoIOS: "libraries/expo-iap/ios/ExpoIapHelper.swift",
  expoOnside: "libraries/expo-iap/ios/onside/OnsideIapModule.swift",
  expoPlugin: "libraries/expo-iap/plugin/src/withIAP.ts",
  horizon:
    "packages/google/openiap/src/horizon/java/dev/hyo/openiap/OpenIapModule.kt",
};

const structuralRule = (id, file, anchor, requirements = {}) => ({
  id,
  file,
  anchor,
  label: `${id} structural contract is missing`,
  ...requirements,
});
const presenceRule = (id, file, anchor, keys, requirements = {}) =>
  structuralRule(id, file, anchor, { keyPresence: keys, ...requirements });
const governedRule = (id, file, anchor, keys, requirements = {}) =>
  presenceRule(id, file, anchor, keys, {
    governedKeySelection: keys,
    ...requirements,
  });

const flutterApplePluginFiles = ["ios", "macos"].map(
  (platform) =>
    `libraries/flutter_inapp_purchase/${platform}/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift`,
);
const inappWarning = {
  requiredPatterns: [
    /RnIapLog\.deprecation\s*\(\s*["']product-type\.inapp["']/,
  ],
  forbiddenPatterns: [/RnIapLog\.warn\s*\(\s*["'][^"']*legacy type ["']?inapp/],
};

export const sourceStructureRules = [
  structuralRule(
    "flutter-dynamic-canonical-selector",
    F.flutterHelpers,
    /\b(?:dynamic|Object\?)\s+_canonicalOrLegacy\s*\([\s\S]*?\}\s*\)\s*\{/,
    { dynamicPresenceCount: 1 },
  ),
  presenceRule(
    "flutter-product-id-selector",
    F.flutterHelpers,
    /\bString\s+_resolveProductId\s*\(/,
    ["id", "productId", "sku"],
  ),
  presenceRule(
    "flutter-error-selector",
    F.flutterErrors,
    /\b(?:dynamic|Object\?)\s+_subResponseCodeAndroidFrom\s*\(/,
    ["subResponseCodeAndroid"],
  ),
  presenceRule(
    "flutter-purchase-platform-selector",
    F.flutter,
    /\bget\s+requestPurchase\s*=>/,
    ["apple", "google"],
  ),
  presenceRule(
    "flutter-selected-purchase-fields",
    F.flutterHelpers,
    /\bgentype\.Purchase\s+convertToPurchase\s*\([\s\S]*?\}\s*\)\s*\{/,
    ["purchaseState", "purchaseStateAndroid"],
    {
      requiredPatterns: [
        /_canonicalOrLegacy\s*\([\s\S]{0,320}?canonicalKey\s*:\s*["']purchaseState["'][\s\S]{0,220}?legacyKey\s*:\s*["']purchaseStateAndroid["']/,
        /_transactionIdFrom\s*\(/,
      ],
    },
  ),
  presenceRule(
    "flutter-transaction-id-selector",
    F.flutterHelpers,
    /\b_transactionIdFrom\s*\(\s*Map</,
    ["transactionId"],
    { requiredPatterns: [/\[\s*["']transactionId["']\s*\]/] },
  ),
  governedRule(
    "flutter-android-custom-channel-selectors",
    F.flutterAndroid,
    /\boverride\s+fun\s+onMethodCall\s*\(/,
    ["skus", "skuArr", "productIds", "skuAndroid", "packageNameAndroid"],
  ),
  ...flutterApplePluginFiles.map((file) =>
    governedRule(
      `flutter-apple-transaction-selector:${file}`,
      file,
      /\bprivate\s+func\s+resolveTransactionId\s*\(/,
      ["transactionId"],
      {
        requiredFilePatterns: [
          /legacyKey\s*:\s*["']transactionIdentifier["']/,
          /warningKey\s*:\s*["']finishTransaction\.transactionIdentifier["']/,
        ],
      },
    ),
  ),
  presenceRule(
    "godot-ios-platform-selector",
    F.godotIOS,
    /\bprivate\s+static\s+func\s+normalizeApplePlatformPayload\s*\(/,
    ["apple"],
    {
      requiredPatterns: [
        /\[\s*["']ios["']\s*\]/,
        /removeValue\s*\(\s*forKey\s*:\s*["']ios["']\s*\)/,
      ],
    },
  ),
  structuralRule(
    "rn-shared-platform-selector",
    F.rnShared,
    /\bexport\s+const\s+selectCanonicalPlatformRequest\s*=/,
    { dynamicPresenceCount: 2 },
  ),
  ...[
    [
      "rn-js-apple-selector",
      F.rn,
      /\bconst\s+selectApplePurchaseRequest\s*=/,
      "apple",
      "ios",
    ],
    [
      "rn-js-google-selector",
      F.rn,
      /\bconst\s+selectGooglePurchaseRequest\s*=/,
      "google",
      "android",
    ],
    [
      "rn-kepler-google-selector",
      F.rnKepler,
      /\bexport\s+const\s+requestPurchase\b/,
      "google",
      "android",
    ],
    [
      "rn-vega-google-selector",
      F.rnVega,
      /\bfunction\s+selectGooglePurchaseRequest\s*\(/,
      "google",
      "android",
    ],
  ].map(([id, file, anchor, canonical, legacy]) =>
    structuralRule(id, file, anchor, {
      requiredPatterns: [canonicalSelectorPattern(canonical, legacy)],
    }),
  ),
  structuralRule(
    "rn-android-native-platform-selector",
    F.rnAndroid,
    /\boverride\s+fun\s+requestPurchase\s*\(/,
    {
      requiredPatterns: [
        /if\s*\(\s*[A-Za-z_$][\w$]*\.google\s*!=\s*null\s*\)/,
        /else\s*\{[^}]{0,320}?[A-Za-z_$][\w$]*\.android/s,
      ],
    },
  ),
  structuralRule(
    "rn-ios-native-platform-selector",
    F.rnIOS,
    /\bfunc\s+requestPurchase\s*\(/,
    {
      requiredPatterns: [
        /if\s+let\s+[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$][\w$]*\.apple\b/,
        /else\s+if\s+case\s+\.second[^=]{0,120}=\s*[A-Za-z_$][\w$]*\.ios\b/,
      ],
    },
  ),
  ...[
    [
      "expo-js-platform-selector",
      F.expo,
      /\bfunction\s+normalizeRequestProps\s*\(/,
      ["apple", "ios", "google", "android"],
    ],
    [
      "expo-kepler-platform-selector",
      F.expoKepler,
      /\bgetAndroidRequest\s*=/,
      ["google", "android"],
    ],
    [
      "expo-android-request-selector",
      F.expoAndroid,
      /\bfun\s+parseRequestPurchaseParams\s*\(/,
      ["google", "skus", "subscriptionOffers"],
    ],
    [
      "expo-onside-platform-selector",
      F.expoOnside,
      /\bprivate\s+func\s+resolveAppleRequest\s*\(/,
      ["apple", "ios"],
    ],
  ].map(([id, file, anchor, keys]) => presenceRule(id, file, anchor, keys)),
  presenceRule(
    "expo-ios-platform-selector",
    F.expoIOS,
    /\bprivate\s+static\s+func\s+normalizeApplePlatformKey\s*\(/,
    ["apple"],
    {
      requiredPatterns: [/removeValue\s*\(\s*forKey\s*:\s*["']ios["']\s*\)/],
    },
  ),
  governedRule(
    "expo-android-deep-link-selector",
    F.expoAndroid,
    /\bfun\s+parseDeepLinkSubscriptionParams\s*\(/,
    ["skuAndroid", "packageNameAndroid"],
  ),
  structuralRule(
    "expo-android-deep-link-call",
    F.expoAndroidModule,
    /\boverride\s+fun\s+definition\s*\(\s*\)/,
    {
      requiredPatterns: [/ExpoIapHelper\.parseDeepLinkSubscriptionParams\s*\(/],
    },
  ),
  ...[
    [
      "expo-plugin-module-env-selector",
      /\bfunction\s+resolveAmazonPlatformFlags\s*\(/,
      ["fireOS", "vegaOS", "horizon", "onside"],
    ],
    [
      "expo-plugin-horizon-id-selector",
      /\bfunction\s+resolveHorizonAppId\s*\(/,
      ["appId", "horizonAppId"],
    ],
    [
      "expo-plugin-ios-billing-selector",
      /\bfunction\s+resolveAlternativeBillingIOS\s*\(/,
      ["alternativeBilling"],
    ],
  ].map(([id, anchor, keys]) => governedRule(id, F.expoPlugin, anchor, keys)),
  structuralRule(
    "flutter-stable-alternative-billing-warning",
    F.flutter,
    /if\s*\(\s*alternativeBillingModeAndroid\s*!=\s*null\s*\)/,
    {
      requiredPatterns: [
        /warnLegacyOnce\s*\(\s*["']init-connection\.alternative-billing-mode-android["']/,
      ],
      forbiddenPatterns: [/debugPrint\s*\(/],
    },
  ),
  structuralRule(
    "rn-android-deprecation-dedup",
    F.rnAndroidLog,
    /\bfun\s+deprecation\s*\(/,
    {
      requiredPatterns: [
        /[A-Za-z_$][\w$]*\.add\s*\(\s*key\s*\)/,
        /Log\.w\s*\(/,
      ],
    },
  ),
  structuralRule(
    "rn-ios-deprecation-dedup",
    F.rnIOSLog,
    /\bstatic\s+func\s+deprecation\s*\(/,
    {
      requiredPatterns: [
        /[A-Za-z_$][\w$]*\.insert\s*\(\s*key\s*\)\.inserted/,
        /\.lock\s*\(\s*\)/,
        /\.unlock\s*\(\s*\)/,
        /\bemit\s*\(\s*\.warn\s*,\s*message\s*\)/,
      ],
    },
  ),
  structuralRule(
    "rn-android-fetch-inapp-warning",
    F.rnAndroid,
    /\boverride\s+fun\s+fetchProducts\s*\(/,
    inappWarning,
  ),
  structuralRule(
    "rn-android-purchases-inapp-warning",
    F.rnAndroid,
    /\boverride\s+fun\s+getAvailablePurchases\s*\(/,
    inappWarning,
  ),
  structuralRule(
    "rn-ios-fetch-inapp-warning",
    F.rnIOS,
    /\bfunc\s+fetchProducts\s*\(/,
    inappWarning,
  ),
  structuralRule(
    "expo-plugin-warning-dedup",
    F.expoPlugin,
    /\bfunction\s+addLegacyPluginWarningOnce\s*\(/,
    {
      requiredPatterns: [
        /[A-Za-z_$][\w$]*\.has\s*\(\s*[A-Za-z_$][\w$]*\s*\)/,
        /[A-Za-z_$][\w$]*\.add\s*\(\s*[A-Za-z_$][\w$]*\s*\)/,
        /WarningAggregator\.addWarningAndroid\s*\(/,
        /WarningAggregator\.addWarningIOS\s*\(/,
      ],
    },
  ),
  structuralRule(
    "expo-plugin-warning-callers",
    F.expoPlugin,
    /\bfunction\s+warnLegacyPluginOptions\s*\(/,
    {
      requiredPatterns: [
        /addLegacyPluginWarningOnce\s*\(\s*["']android["']\s*,\s*["']android\.amazon\.fireOS["']/,
        /addLegacyPluginWarningOnce\s*\(\s*["']android["']\s*,\s*["']android\.amazon\.vegaOS\.boolean["']/,
        /addLegacyPluginWarningOnce\s*\(\s*["']android["']\s*,\s*["']android\.horizonAppId["']/,
        /addLegacyPluginWarningOnce\s*\(\s*["']android["']\s*,\s*["']horizonAppId["']/,
        /addLegacyPluginWarningOnce\s*\(\s*["']ios["']\s*,\s*["']iosAlternativeBilling["']/,
      ],
      forbiddenPatterns: [/WarningAggregator\.addWarning(?:Android|IOS)\s*\(/],
    },
  ),
  structuralRule(
    "horizon-manifest-warning-dedup",
    F.horizon,
    /\bfun\s+warnLegacyHorizonAppIdKey\s*\(/,
    {
      requiredPatterns: [
        /[A-Za-z_$][\w$]*\.add\s*\(\s*key\s*\)/,
        /OpenIapLog\.warn\s*\(/,
      ],
    },
  ),
  structuralRule(
    "horizon-manifest-warning-caller",
    F.horizon,
    /\bfun\s+resolveHorizonAppId\s*\(/,
    {
      requiredPatterns: [/warnLegacyKey\s*\(\s*key\s*\)/],
      requiredFilePatterns: [
        /warnLegacyKey\s*:\s*\(\s*String\s*\)\s*->\s*Unit\s*=\s*::warnLegacyHorizonAppIdKey/,
      ],
    },
  ),
  structuralRule(
    "apple-store-platform-selector",
    "packages/apple/Sources/OpenIapStore.swift",
    /\bstatic\s+func\s+sku\s*\(/,
    {
      requiredPatterns: [
        /if\s+let\s+[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$][\w$]*\.apple\b/,
        /guard\s+let\s+[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$][\w$]*\.ios\b/,
      ],
      requiredFilePatterns: [
        /OpenIapLog\.deprecation\s*\(/,
        /Legacy\s+ios\s+compatibility\s+is\s+scheduled\s+for\s+removal\s+in\s+OpenIAP\s+3\.0\./,
      ],
    },
  ),
  structuralRule(
    "google-store-platform-selector",
    "packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt",
    /\binternal\s+object\s+OpenIapStorePurchaseRequestResolver\s*\{/,
    {
      requiredPatterns: [
        /if\s*\(\s*[A-Za-z_$][\w$]*\.google\s*!=\s*null\s*\)/,
        /else\s*\{[\s\S]{0,220}?[A-Za-z_$][\w$]*\.android\?\.let/,
        /warnAboutLegacyAndroid\s*\(/,
      ],
      requiredFilePatterns: [
        /if\s*\(\s*![A-Za-z_$][\w$]*\.add\s*\(\s*key\s*\)\s*\)\s*return/,
        /Legacy\s+android\s+compatibility\s+is\s+scheduled\s+for\s+removal\s+in\s+OpenIAP\s+3\.0\./,
      ],
    },
  ),
];

export function evaluateSourceStructureRule(rule, source) {
  const region = extractBraceDelimitedRegion(source, rule.anchor);
  if (region === null) return false;
  const code = normalizeSourceForStructuralMatching(region);
  const fileCode = normalizeSourceForStructuralMatching(source);

  if (
    (rule.keyPresence ?? []).some((key) => !hasStructuralKeyPresence(code, key))
  ) {
    return false;
  }
  if (
    (rule.governedKeySelection ?? []).some(
      (key) => !hasGovernedKeySelection(code, key),
    )
  ) {
    return false;
  }
  if (
    rule.dynamicPresenceCount !== undefined &&
    dynamicPresenceIdentifiers(code).size < rule.dynamicPresenceCount
  ) {
    return false;
  }
  if (
    (rule.requiredPatterns ?? []).some(
      (pattern) => !matchesForbiddenSourcePattern(code, pattern),
    )
  ) {
    return false;
  }
  if (
    (rule.requiredFilePatterns ?? []).some(
      (pattern) => !matchesForbiddenSourcePattern(fileCode, pattern),
    )
  ) {
    return false;
  }
  if (
    (rule.forbiddenPatterns ?? []).some((pattern) =>
      matchesForbiddenSourcePattern(code, pattern),
    )
  ) {
    return false;
  }
  return true;
}

export function collectSourceStructureViolations(file, source) {
  return sourceStructureRules
    .filter(
      (rule) =>
        rule.file === file && !evaluateSourceStructureRule(rule, source),
    )
    .map((rule) => rule.label);
}

const forbiddenSourcePatterns = [
  ...SCHEMA_FILE_NAMES.map((file) => ({
    file: `packages/gql/src/${file}`,
    pattern:
      /(?:isBillingProgramAvailable|createBillingProgramReportingDetails)Async/,
    label: "schema must name real public billing-program operations",
  })),
  ...[
    "types.ts",
    "Types.swift",
    "Types.kt",
    "types.dart",
    "types.gd",
    "Types.cs",
  ].map((file) => ({
    file: `packages/gql/src/generated/${file}`,
    pattern:
      /(?:isBillingProgramAvailable|createBillingProgramReportingDetails)Async/,
    label: "generated OpenIAP types must not expose native Async method names",
  })),
  {
    file: "packages/docs/src/pages/docs/updates/deprecations.tsx",
    pattern:
      /(?:isBillingProgramAvailable|createBillingProgramReportingDetails)Async/,
    label: "migration catalog must name real public billing-program operations",
  },
  {
    file: "packages/docs/src/pages/docs/types/product.tsx",
    pattern:
      /(?:<del>\s*(?:Product\.)?platform\s*<\/del>|textDecoration\s*:\s*["']line-through["'][\s\S]{0,160}>\s*(?:Product\.)?platform\s*<)/,
    label: "canonical Product platform docs must not be marked removed",
  },
  {
    file: "packages/docs/src/pages/docs/types/subscription-product.tsx",
    pattern:
      /(?:<del>\s*(?:Product\.)?platform\s*<\/del>|textDecoration\s*:\s*["']line-through["'][\s\S]{0,160}>\s*(?:Product\.)?platform\s*<)/,
    label: "canonical subscription platform docs must not be marked removed",
  },
  {
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt",
    pattern:
      /Class\.forName\("dev\.hyo\.openiap\.(?:AlternativeBillingMode|listener\.)/,
    label:
      "canonical OpenIapStore loader must not reflect on removable legacy types",
  },
  {
    file: "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/AmazonInAppPurchaseAndroid.kt",
    pattern:
      /Class\.forName\("dev\.hyo\.openiap\.(?:AlternativeBillingMode|listener\.)/,
    label: "KMP non-Play loader must not reflect on removable legacy types",
  },
  {
    file: "libraries/maui-iap/android/openiap/src/main/java/dev/hyo/openiap/maui/OpenIapMauiModule.kt",
    pattern: /import\s+dev\.hyo\.openiap\.AlternativeBillingMode\b/,
    label: "MAUI bridge must not retain an unused legacy mode dependency",
  },
  {
    file: "packages/google/ALTERNATIVE_BILLING.md",
    pattern: /val\s+iapStore\s*=\s*OpenIapStore\([^\n]*AlternativeBillingMode/,
    label: "canonical Google guide must not initialize through a legacy mode",
  },
  {
    file: "libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt",
    pattern:
      /subscriptionOffers\.ifEmpty\s*\{\s*convertAnyListToSubscriptionOffers\(map\["offers"\]\)\s*\}/,
    label:
      "KMP callers must consume the canonical subscriptionOffers key after the native payload normalizer",
  },
  {
    file: "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
    pattern: /\bOpenIapLog\.(?:d|i|w|e)\s*\(/,
    label:
      "Flutter Android internals must use canonical OpenIapLog names before the OpenIAP 3 alias removal",
  },
  {
    file: "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
    pattern: /params\["skus"\][\s\S]{0,160}\?:\s*\(params\["skuArr"\]/,
    label:
      "Flutter Android skuArr fallback must pass through the warning-aware canonical resolver",
  },
  {
    file: "libraries/godot-iap/android/src/main/java/dev/hyo/godotiap/GodotIap.kt",
    pattern: /if\s*\(props\["iapkit"\]\s*!=\s*null\)/,
    label:
      "Godot Android canonical IAPKit precedence must use key presence, not a non-null value",
  },
  {
    file: "libraries/godot-iap/addons/godot-iap/godot_iap.gd",
    pattern: /props_dict\.get\("iapkit"\)\s*==\s*null/,
    label:
      "Godot GDScript canonical IAPKit precedence must use key presence, not a non-null value",
  },
];

const generatedDeprecationOutputs = [
  {
    file: "packages/gql/src/generated/types.ts",
    // The TypeScript generator emits string unions, so enum-member JSDoc
    // cannot be attached to an individual generated member.
    omittedKinds: new Set(["EnumValueDefinition"]),
  },
  ...["Types.swift", "Types.kt", "types.dart", "types.gd", "Types.cs"].map(
    (file) => ({
      file: `packages/gql/src/generated/${file}`,
      omittedKinds: new Set(),
    }),
  ),
];

const rootOperationReplacements = {
  acknowledgePurchase: "acknowledgePurchaseAndroid",
  checkAlternativeBillingAvailabilityAndroid:
    "isBillingProgramAvailableAndroid",
  consumePurchase: "consumePurchaseAndroid",
  createAlternativeBillingTokenAndroid:
    "createBillingProgramReportingDetailsAndroid",
  getReceiptIOS: "getReceiptDataIOS",
  getStorefrontIOS: "getStorefront",
  requestPromotedProductIOS: "getPromotedProductIOS",
  requestPurchaseOnPromotedProductIOS: "promotedProductListenerIOS",
  showAlternativeBillingDialogAndroid: "launchExternalLinkAndroid",
  validateReceipt: "verifyPurchase",
  validateReceiptAndroid: "verifyPurchase",
  validateReceiptIOS: "verifyPurchase",
};

const kmpRootOperationReplacements = {
  ...rootOperationReplacements,
  checkAlternativeBillingAvailabilityAndroid:
    "isBillingProgramAvailableAndroid with BillingProgramAndroid.ExternalOffer",
  createAlternativeBillingTokenAndroid:
    "createBillingProgramReportingDetailsAndroid with BillingProgramAndroid.ExternalOffer",
  requestPurchaseOnPromotedProductIOS: "promotedProductListener",
};

const appleManualShimNotices = [
  ...[
    ["OpenIapErrorCode", "ErrorCode"],
    ["OpenIapEvent", "IapEvent"],
    ["OpenIapPlatform", "IapPlatform"],
  ].map(([symbol, replacement]) => ({
    file: "packages/apple/Sources/Models/TypeAliases.swift",
    declaration: new RegExp(`public\\s+typealias\\s+${symbol}\\b`),
    marker: "@available(*, deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacement,
    symbol: `apple.${symbol}`,
  })),
  ...[
    ["ReceiptValidationProps", "VerifyPurchaseProps"],
    ["ReceiptValidationResult", "VerifyPurchaseResult"],
    ["ReceiptValidationResultIOS", "VerifyPurchaseResultIOS"],
  ].map(([symbol, replacement]) => ({
    file: "packages/apple/Sources/Models/ReceiptValidationCompat.swift",
    declaration: new RegExp(`public\\s+typealias\\s+${symbol}\\b`),
    marker: "@available(*, deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacement,
    symbol: `apple.${symbol}`,
  })),
  ...["specVersion", "OpenIapVersion.specVersion"].map(
    (replacement, occurrence) => ({
      file: "packages/apple/Sources/OpenIapVersion.swift",
      declaration: /public\s+static\s+var\s+gqlVersion\b/,
      marker: "@available(*, deprecated",
      notice: OPENIAP_3_REMOVAL_NOTICE,
      replacement,
      occurrence,
      symbol: `apple.gqlVersion#${occurrence + 1}`,
    }),
  ),
  ...[
    [
      "requestPurchaseOnPromotedProductIOS",
      1,
      ["promotedProductListenerIOS", "requestPurchase"],
    ],
    ["validateReceiptIOS", 2, ["verifyPurchase"]],
    ["validateReceipt", 2, ["verifyPurchase"]],
    ["getStorefrontIOS", 1, ["getStorefront"]],
  ].flatMap(([symbol, count, replacements]) =>
    Array.from({ length: count }, (_, occurrence) => ({
      file: "packages/apple/Sources/OpenIapProtocol.swift",
      declaration: new RegExp(`func\\s+${symbol}\\s*\\(`),
      marker: "@available(*, deprecated",
      notice: OPENIAP_3_REMOVAL_NOTICE,
      replacements,
      occurrence,
      symbol: `apple.OpenIapProtocol.${symbol}${
        count > 1 ? `#${occurrence + 1}` : ""
      }`,
    })),
  ),
  ...[
    [
      "requestPurchaseOnPromotedProductIOS",
      ["promotedProductListenerIOS", "requestPurchase"],
    ],
    ["validateReceiptIOS", ["verifyPurchase"]],
    ["validateReceipt", ["verifyPurchase"]],
    ["getStorefrontIOS", ["getStorefront"]],
  ].map(([symbol, replacements]) => ({
    file: "packages/apple/Sources/OpenIapModule.swift",
    declaration: new RegExp(`public\\s+func\\s+${symbol}\\s*\\(`),
    marker: "@available(*, deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacements,
    symbol: `apple.OpenIapModule.${symbol}`,
  })),
  ...[
    [
      "requestPurchaseOnPromotedProductIOS",
      ["promotedProductListenerIOS", "requestPurchase"],
      `public\\s+func\\s+requestPurchaseOnPromotedProductIOS\\s*\\(`,
    ],
    [
      "validateReceipt",
      ["verifyPurchase(sku:)"],
      `public\\s+func\\s+validateReceipt\\s*\\(\\s*sku:`,
    ],
    [
      "getStorefrontIOS",
      ["getStorefront"],
      `public\\s+func\\s+getStorefrontIOS\\s*\\(`,
    ],
    [
      "deepLinkToSubscriptionsIOS",
      ["deepLinkToSubscriptions"],
      `public\\s+func\\s+deepLinkToSubscriptionsIOS\\s*\\(`,
    ],
  ].map(([symbol, replacements, declaration]) => ({
    file: "packages/apple/Sources/OpenIapStore.swift",
    declaration: new RegExp(declaration),
    marker: "@available(*, deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacements,
    symbol: `apple.OpenIapStore.${symbol}`,
  })),
  ...[
    [
      "requestPurchaseOnPromotedProductIOSWithCompletion",
      ["promotedProductListenerIOS", "requestPurchase"],
    ],
    ["getStorefrontIOSWithCompletion", ["getStorefrontWithCompletion"]],
  ].map(([symbol, replacements]) => ({
    file: "packages/apple/Sources/OpenIapModule+ObjC.swift",
    declaration: new RegExp(`@objc\\s+func\\s+${symbol}\\b`),
    marker: "@available(*, deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacements,
    symbol: `apple.ObjC.${symbol}`,
  })),
  {
    file: "packages/apple/Sources/OpenIapModule+ObjC.swift",
    declaration:
      /@objc\s+func\s+requestSubscriptionWithSku\s*\(\s*_\s+sku:\s*String,\s*offer:/,
    marker: "@available(*, deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacements: [
      "compactJWS",
      "promotionalOfferJWS",
      "winBackOfferId",
      "billingPlanType",
    ],
    symbol: "apple.ObjC.requestSubscriptionWithSku.short",
  },
];

const googleCommonShimNotices = [
  {
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/AlternativeBillingMode.kt",
    declaration: /enum\s+class\s+AlternativeBillingMode\b/,
    marker: "@Deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacements: [
      "BillingProgramAndroid",
      "InitConnectionConfig.enableBillingProgramAndroid",
    ],
    symbol: "google.AlternativeBillingMode",
  },
  ...[
    ["d", "debug"],
    ["i", "info"],
    ["w", "warn"],
    ["e", "error"],
  ].map(([symbol, replacement]) => ({
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/OpenIapLog.kt",
    declaration: new RegExp(`fun\\s+${symbol}\\s*\\(`),
    marker: "@Deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacement,
    symbol: `google.OpenIapLog.${symbol}`,
  })),
  ...[
    ["ReceiptValidationProps", "VerifyPurchaseProps"],
    ["ReceiptValidationResult", "VerifyPurchaseResult"],
    ["ReceiptValidationResultIOS", "VerifyPurchaseResultIOS"],
  ].map(([symbol, replacement]) => ({
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/compat/ReceiptValidationCompat.kt",
    declaration: new RegExp(`typealias\\s+${symbol}\\b`),
    marker: "@Deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacement,
    symbol: `google.${symbol}`,
  })),
  {
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/OpenIapError.kt",
    declaration: /object\s+InvalidReceipt\b/,
    marker: "@Deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacement: "InvalidPurchaseVerification",
    symbol: "google.OpenIapError.InvalidReceipt",
  },
  ...[
    [
      "packages/google/openiap/src/main/java/dev/hyo/openiap/listener/UserChoiceBillingListener.kt",
      "data\\s+class\\s+UserChoiceDetails\\b",
      "UserChoiceBillingDetails",
      "UserChoiceDetails",
    ],
    [
      "packages/google/openiap/src/main/java/dev/hyo/openiap/listener/UserChoiceBillingListener.kt",
      "fun\\s+interface\\s+UserChoiceBillingListener\\b",
      "OpenIapUserChoiceBillingListener",
      "UserChoiceBillingListener",
    ],
    [
      "packages/google/openiap/src/main/java/dev/hyo/openiap/listener/DeveloperProvidedBillingListener.kt",
      "data\\s+class\\s+DeveloperProvidedBillingDetails\\b",
      "DeveloperProvidedBillingDetailsAndroid",
      "DeveloperProvidedBillingDetails",
    ],
    [
      "packages/google/openiap/src/main/java/dev/hyo/openiap/listener/DeveloperProvidedBillingListener.kt",
      "fun\\s+interface\\s+DeveloperProvidedBillingListener\\b",
      "OpenIapDeveloperProvidedBillingListener",
      "DeveloperProvidedBillingListener",
    ],
  ].map(([file, declaration, replacement, symbol]) => ({
    file,
    declaration: new RegExp(declaration),
    marker: "@Deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacement,
    symbol: `google.${symbol}`,
  })),
  ...[
    ["validateReceipt", "val", ["verifyPurchase"]],
    [
      "checkAlternativeBillingAvailability",
      "fun",
      ["isBillingProgramAvailable", "ExternalOffer"],
    ],
    ["showAlternativeBillingInformationDialog", "fun", ["launchExternalLink"]],
    [
      "createAlternativeBillingReportingToken",
      "fun",
      ["createBillingProgramReportingDetails", "ExternalOffer"],
    ],
    [
      "setUserChoiceBillingListener",
      "fun",
      ["addUserChoiceBillingListener", "removeUserChoiceBillingListener"],
    ],
    [
      "setDeveloperProvidedBillingListener",
      "fun",
      [
        "addDeveloperProvidedBillingListener",
        "removeDeveloperProvidedBillingListener",
      ],
    ],
  ].map(([symbol, kind, replacements]) => ({
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/OpenIapProtocol.kt",
    declaration:
      kind === "val"
        ? new RegExp(`val\\s+${symbol}\\b`)
        : new RegExp(
            `(?:@Suppress\\("DEPRECATION"\\)\\s+)?(?:suspend\\s+)?fun\\s+${symbol}\\s*\\(`,
          ),
    marker: "@Deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacements,
    symbol: `google.OpenIapProtocol.${symbol}`,
  })),
  ...[
    ["connectionStatus", "val", ["isConnected"]],
    [
      "setUserChoiceBillingListener",
      "fun",
      ["addUserChoiceBillingListener", "removeUserChoiceBillingListener"],
    ],
    [
      "setDeveloperProvidedBillingListener",
      "fun",
      [
        "addDeveloperProvidedBillingListener",
        "removeDeveloperProvidedBillingListener",
      ],
    ],
    [
      "checkAlternativeBillingAvailability",
      "fun",
      ["isBillingProgramAvailable", "ExternalOffer"],
    ],
    ["showAlternativeBillingInformationDialog", "fun", ["launchExternalLink"]],
    [
      "createAlternativeBillingReportingToken",
      "fun",
      ["createBillingProgramReportingDetails", "ExternalOffer"],
    ],
  ].map(([symbol, kind, replacements]) => ({
    file: "packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt",
    declaration:
      kind === "val"
        ? new RegExp(`val\\s+${symbol}\\b`)
        : new RegExp(
            `(?:@Suppress\\("DEPRECATION"\\)\\s+)?(?:suspend\\s+)?fun\\s+${symbol}\\s*\\(`,
          ),
    marker: "@Deprecated",
    notice: OPENIAP_3_REMOVAL_NOTICE,
    replacements,
    symbol: `google.OpenIapStore.${symbol}`,
  })),
];

const googleFlavorModuleShimNotices = ["play", "amazon", "horizon"].flatMap(
  (flavor) => {
    const file = `packages/google/openiap/src/${flavor}/java/dev/hyo/openiap/OpenIapModule.kt`;
    const primaryReplacements =
      flavor === "play"
        ? ["OpenIapModule(context)", "InitConnectionConfig", "add/remove APIs"]
        : ["OpenIapModule(context)"];
    const requirements = [
      {
        declaration: /constructor\s*\(\s*private\s+val\s+context:\s*Context,/,
        replacements: primaryReplacements,
        symbol: `google.${flavor}.OpenIapModule.legacyPrimaryConstructor`,
      },
      ...[
        ["validateReceipt", "val", ["verifyPurchase"]],
        [
          "checkAlternativeBillingAvailability",
          "fun",
          ["isBillingProgramAvailable", "ExternalOffer"],
        ],
        [
          "showAlternativeBillingInformationDialog",
          "fun",
          ["launchExternalLink"],
        ],
        [
          "createAlternativeBillingReportingToken",
          "fun",
          ["createBillingProgramReportingDetails", "ExternalOffer"],
        ],
        [
          "setUserChoiceBillingListener",
          "fun",
          ["addUserChoiceBillingListener", "removeUserChoiceBillingListener"],
        ],
        [
          "setDeveloperProvidedBillingListener",
          "fun",
          [
            "addDeveloperProvidedBillingListener",
            "removeDeveloperProvidedBillingListener",
          ],
        ],
      ].map(([symbol, kind, replacements]) => ({
        declaration:
          kind === "val"
            ? new RegExp(`override\\s+val\\s+${symbol}\\b`)
            : new RegExp(`override\\s+(?:suspend\\s+)?fun\\s+${symbol}\\s*\\(`),
        replacements,
        symbol: `google.${flavor}.OpenIapModule.${symbol}`,
      })),
    ];
    if (flavor !== "horizon") {
      requirements.push({
        declaration:
          /constructor\s*\(\s*context:\s*Context,\s*enableAlternativeBilling:\s*Boolean/,
        replacements:
          flavor === "play"
            ? ["OpenIapModule(context)", "InitConnectionConfig"]
            : ["OpenIapModule(context)"],
        symbol: `google.${flavor}.OpenIapModule.booleanConstructor`,
      });
    }
    return requirements.map((requirement) => ({
      file,
      marker: "@Deprecated",
      notice: OPENIAP_3_REMOVAL_NOTICE,
      ...requirement,
    }));
  },
);

const googleFlavorStoreShimNotices = ["play", "amazon", "horizon"].flatMap(
  (flavor) => {
    const file = `packages/google/openiap/src/${flavor}/java/dev/hyo/openiap/store/OpenIapStoreExtensions.kt`;
    const requirements = [
      {
        declaration:
          /fun\s+OpenIapStore\s*\(\s*context:\s*Context,\s*alternativeBillingMode:/,
        replacements:
          flavor === "play"
            ? ["OpenIapStore(context)", "InitConnectionConfig"]
            : ["OpenIapStore(context)"],
        symbol: `google.${flavor}.OpenIapStore.modeFactory`,
      },
    ];
    if (flavor === "play") {
      requirements.push({
        declaration:
          /fun\s+OpenIapStore\s*\(\s*context:\s*Context,\s*enableAlternativeBilling:/,
        replacements: ["OpenIapStore(context)", "InitConnectionConfig"],
        symbol: "google.play.OpenIapStore.booleanFactory",
      });
    }
    return requirements.map((requirement) => ({
      file,
      marker: "@Deprecated",
      notice: OPENIAP_3_REMOVAL_NOTICE,
      ...requirement,
    }));
  },
);

const requiredPublicSymbolNotices = [
  ...appleManualShimNotices,
  ...googleCommonShimNotices,
  ...googleFlavorModuleShimNotices,
  ...googleFlavorStoreShimNotices,
  ...[
    "validateReceipt",
    "validateReceiptIOS",
    "requestPromotedProductIOS",
    "requestPurchaseOnPromotedProductIOS",
    "acknowledgePurchase",
    "consumePurchase",
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
  ].map((symbol) => ({
    file: "libraries/react-native-iap/src/index.kepler.ts",
    declaration: new RegExp(
      `export\\s+(?:type\\s+${symbol}\\b|const\\s+${symbol}\\b)`,
    ),
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    replacement: rootOperationReplacements[symbol],
    symbol,
  })),
  ...[
    "validateReceipt",
    "requestPurchaseOnPromotedProductIOS",
    "acknowledgePurchase",
    "consumePurchase",
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
  ].map((symbol) => ({
    file: "libraries/expo-iap/src/index.kepler.ts",
    declaration: new RegExp(
      `export\\s+(?:type\\s+${symbol}\\b|const\\s+${symbol}\\b)`,
    ),
    marker: "@deprecated",
    notice: "expo-iap 5.0.0",
    replacement: rootOperationReplacements[symbol],
    symbol,
  })),
  ...[
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
  ].map((symbol) => ({
    file: "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    declaration: new RegExp(
      `gentype\\.Mutation\\w+\\s+get\\s+${symbol}\\b`,
      "s",
    ),
    marker: "@Deprecated",
    notice: "flutter_inapp_purchase 10.0.0",
    replacement: rootOperationReplacements[symbol],
    symbol,
  })),
  ...["replacementMode", "useAlternativeBilling"].flatMap((symbol) => {
    const declarations =
      symbol === "useAlternativeBilling"
        ? [
            /bool\?\s+useAlternativeBilling\b/g,
            /bool\?\s+useAlternativeBilling\b/g,
          ]
        : [/int\?\s+replacementMode\b/];
    return declarations.map((declaration, index) => ({
      file: "libraries/flutter_inapp_purchase/lib/builders.dart",
      declaration,
      marker: "@Deprecated",
      notice: "flutter_inapp_purchase 10.0.0",
      replacement:
        symbol === "replacementMode"
          ? "subscriptionProductReplacementParams"
          : "enableBillingProgramAndroid",
      symbol: `${symbol}${declarations.length > 1 ? `#${index + 1}` : ""}`,
      occurrence: symbol === "useAlternativeBilling" ? index : 0,
    }));
  }),
  ...["ios", "android"].map((symbol) => ({
    file: "libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/dsl/PurchaseDsl.kt",
    declaration: new RegExp(`fun\\s+${symbol}\\s*\\(`),
    marker: "@Deprecated",
    notice: "kmp-iap 3.0.0",
    replacement: symbol === "ios" ? "apple(block)" : "google(block)",
    symbol: `PurchaseRequestBuilder.${symbol}`,
  })),
  {
    file: "libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/dsl/PurchaseDsl.kt",
    declaration: /var\s+replacementMode\s*:/,
    marker: "@Deprecated",
    notice: "kmp-iap 3.0.0",
    replacement: "subscriptionProductReplacementParams",
    symbol: "AndroidOptionsBuilder.replacementMode",
  },
  ...[
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
    "requestPurchaseOnPromotedProductIOS",
    "validateReceipt",
    "getStorefrontIOS",
    "validateReceiptIOS",
  ].map((symbol) => ({
    file: "libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/KmpIap.kt",
    declaration: new RegExp(`override\\s+suspend\\s+fun\\s+${symbol}\\s*\\(`),
    marker: "@Deprecated",
    notice: "kmp-iap 3.0.0",
    replacement: kmpRootOperationReplacements[symbol],
    symbol: `KmpInAppPurchase.${symbol}`,
  })),
  ...[
    "validateReceipt",
    "validateReceiptIOS",
    "getStorefrontIOS",
    "requestPromotedProductIOS",
    "requestPurchaseOnPromotedProductIOS",
    "getReceiptIOS",
    "acknowledgePurchase",
    "consumePurchase",
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
  ].map((symbol) => ({
    file: "libraries/react-native-iap/src/index.ts",
    declaration: new RegExp(`export\\s+const\\s+${symbol}\\b`),
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    replacement: rootOperationReplacements[symbol],
    symbol,
  })),
  ...["requestPromotedProductIOS", "getReceiptIOS"].map((symbol) => ({
    file: "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
    declaration: new RegExp(`${symbol}\\s*\\(`),
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    replacement: rootOperationReplacements[symbol],
    symbol: `RnIap.${symbol}`,
  })),
  ...[
    ["replacementMode", "subscriptionProductReplacementParams"],
    ["ios", "apple"],
    ["android", "google"],
    ["platform", "store"],
  ].map(([symbol, replacement]) => ({
    file: "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
    declaration:
      symbol === "replacementMode"
        ? /replacementMode\?\s*:\s*RequestSubscriptionAndroidProps/
        : symbol === "ios"
          ? /ios\?\s*:\s*NitroRequestPurchaseIos/
          : symbol === "android"
            ? /android\?\s*:\s*NitroRequestPurchaseAndroid/
            : /platform\s*:\s*IapPlatform/,
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    replacement,
    symbol: `RnIap.${symbol}`,
  })),
  ...[
    ["willExpireSoon", ["daysUntilExpirationIOS"]],
    ["subscriptionInfoIOS", ["subscriptionOffers", "subscriptionGroupIdIOS"]],
    ["discountsIOS", ["subscriptionOffers"]],
    ["subscriptionOfferDetailsAndroid", ["subscriptionOffers"]],
    ["oneTimePurchaseOfferDetailsAndroid", ["discountOffers"]],
  ].map(([symbol, replacements]) => ({
    file: "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
    declaration: new RegExp(`${symbol}\\?\\s*:`),
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    replacements,
    symbol: `RnIap.${symbol}`,
  })),
  ...[
    "validateReceipt",
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
  ].map((symbol) => ({
    file: "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
    declaration: new RegExp(`${symbol}\\s*\\(`),
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    replacement: rootOperationReplacements[symbol],
    symbol: `RnIap.${symbol}`,
  })),
  ...[
    "validateReceipt",
    "requestPurchaseOnPromotedProductIOS",
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
  ].map((symbol) => ({
    file: "libraries/react-native-iap/src/hooks/useIAP.ts",
    declaration: new RegExp(`${symbol}\\??\\s*:`),
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    replacement:
      symbol === "requestPurchaseOnPromotedProductIOS"
        ? "onPromotedProductIOS"
        : rootOperationReplacements[symbol],
    symbol: `UseIAPHookResult.${symbol}`,
  })),
  {
    file: "libraries/react-native-iap/src/hooks/useIAP.ts",
    declaration: /alternativeBillingModeAndroid\?\s*:/,
    marker: "@deprecated",
    notice: "react-native-iap 16.0.0",
    replacement: "enableBillingProgramAndroid",
    symbol: "UseIAPOptions.alternativeBillingModeAndroid",
  },
  {
    file: "libraries/expo-iap/src/index.ts",
    declaration: /export\s+const\s+validateReceipt\b/,
    marker: "@deprecated",
    notice: "expo-iap 5.0.0",
    replacement: "verifyPurchase",
    symbol: "validateReceipt",
  },
  ...[
    "validateReceiptAndroid",
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
  ].map((symbol) => ({
    file: "libraries/expo-iap/src/modules/android.ts",
    declaration: new RegExp(`export\\s+const\\s+${symbol}\\b`),
    marker: "@deprecated",
    notice: "expo-iap 5.0.0",
    replacement: rootOperationReplacements[symbol],
    symbol,
  })),
  ...[
    "getReceiptIOS",
    "getStorefrontIOS",
    "validateReceiptIOS",
    "requestPurchaseOnPromotedProductIOS",
  ].map((symbol) => ({
    file: "libraries/expo-iap/src/modules/ios.ts",
    declaration: new RegExp(`export\\s+const\\s+${symbol}\\b`),
    marker: "@deprecated",
    notice: "expo-iap 5.0.0",
    replacement: rootOperationReplacements[symbol],
    symbol,
  })),
  ...[
    "validateReceipt",
    "requestPurchaseOnPromotedProductIOS",
    "checkAlternativeBillingAvailabilityAndroid",
    "showAlternativeBillingDialogAndroid",
    "createAlternativeBillingTokenAndroid",
  ].map((symbol) => ({
    file: "libraries/expo-iap/src/useIAP.ts",
    declaration: new RegExp(`${symbol}\\s*:`),
    marker: "@deprecated",
    notice: "expo-iap 5.0.0",
    replacement:
      symbol === "requestPurchaseOnPromotedProductIOS"
        ? "onPromotedProductIOS"
        : rootOperationReplacements[symbol],
    symbol: `UseIAPHookResult.${symbol}`,
  })),
  {
    file: "libraries/expo-iap/src/useIAP.ts",
    declaration: /alternativeBillingModeAndroid\?\s*:/,
    marker: "@deprecated",
    notice: "expo-iap 5.0.0",
    replacement: "enableBillingProgramAndroid",
    symbol: "UseIAPOptions.alternativeBillingModeAndroid",
  },
  ...[
    ["iosAlternativeBilling", "ios.alternativeBilling"],
    ["horizonAppId", "android.horizon.appId"],
  ].flatMap(([symbol, replacement]) => {
    const count = symbol === "horizonAppId" ? 2 : 1;
    return Array.from({ length: count }, (_, occurrence) => ({
      file: "libraries/expo-iap/plugin/src/expoConfig.augmentation.d.ts",
      declaration: new RegExp(`${symbol}\\?\\s*:`, "g"),
      marker: "@deprecated",
      notice: "expo-iap 5.0.0",
      replacement,
      occurrence,
      symbol: `${symbol}${count > 1 ? `#${occurrence + 1}` : ""}`,
    }));
  }),
  {
    file: "libraries/expo-iap/plugin/src/expoConfig.augmentation.d.ts",
    declaration: /fireOS\?\s*:\s*boolean/g,
    marker: "@deprecated",
    notice: "expo-iap 5.0.0",
    replacement: "modules.amazon.fireOS",
    occurrence: 1,
    symbol: "android.amazon.fireOS",
  },
  ...[
    ["purchaseUpdated", "purchaseUpdatedListener"],
    ["purchaseError", "purchaseErrorListener"],
    ["connectionUpdated", "initConnection"],
    ["getStorefrontIOS", "getStorefront"],
    ["requestPurchaseOnPromotedProductIOS", "purchasePromoted"],
    ["validateReceiptIOS", "verifyPurchase"],
    ["validateReceipt", "verifyPurchase"],
    [
      "checkAlternativeBillingAvailabilityAndroid",
      "isBillingProgramAvailableAndroid",
    ],
    ["showAlternativeBillingDialogAndroid", "launchExternalLinkAndroid"],
    [
      "createAlternativeBillingTokenAndroid",
      "createBillingProgramReportingDetailsAndroid",
    ],
  ].map(([symbol, replacement]) => ({
    file: "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    declaration: new RegExp(
      symbol === "purchaseUpdated" ||
        symbol === "purchaseError" ||
        symbol === "connectionUpdated"
        ? `Stream<[^;]+>\\s+get\\s+${symbol}\\b`
        : `(?:gentype\\.\\w+\\s+)?get\\s+${symbol}\\b`,
      "s",
    ),
    marker: "@Deprecated",
    notice: "flutter_inapp_purchase 10.0.0",
    replacement,
    symbol,
  })),
  ...[
    ["request_purchase_on_promoted_product_ios", "promoted_product_ios"],
    ["get_storefront_ios", "get_storefront"],
    ["validate_receipt_ios", "verify_purchase"],
    ["validate_receipt", "verify_purchase"],
    [
      "check_alternative_billing_availability_android",
      "is_billing_program_available_android",
    ],
    ["show_alternative_billing_dialog_android", "launch_external_link_android"],
    [
      "create_alternative_billing_token_android",
      "create_billing_program_reporting_details_android",
    ],
  ].map(([symbol, replacement]) => ({
    file: "libraries/godot-iap/addons/godot-iap/godot_iap.gd",
    declaration: new RegExp(`func\\s+${symbol}\\s*\\(`),
    marker: "## @deprecated",
    notice: "godot-iap 3.0.0",
    replacement,
    symbol,
  })),
  ...[
    ["getStorefrontIOS", "getStorefront"],
    ["requestPurchaseOnPromotedProductIOS", "promotedProductIOS"],
    ["validateReceiptIOS", "verifyPurchase"],
  ].map(([symbol, replacement]) => ({
    file: "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift",
    declaration: new RegExp(`@Callable\\s+public\\s+func\\s+${symbol}\\s*\\(`),
    marker: "@available(*, deprecated",
    notice: "godot-iap 3.0.0",
    replacement,
    symbol,
  })),
  {
    file: "libraries/maui-iap/src/OpenIap.Maui/OpenIap.cs",
    declaration:
      /\[EditorBrowsable\(EditorBrowsableState\.Never\)\]\s+public\s+static\s+class\s+Iap\b/,
    marker: "[Obsolete(",
    notice: "OpenIap.Maui 2.0.0",
    replacement: "OpenIapClient",
    symbol: "Iap",
  },
];

function walk(directory, extensions) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "build") continue;
      files.push(...walk(target, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      files.push(target);
    }
  }
  return files;
}

const lineNumberAt = (source, index) =>
  source.slice(0, index).split(/\r?\n/).length;

const containsNotice = (block, notice) =>
  block
    .replace(/^\s*\* ?/gm, "")
    .replace(/\s+/g, " ")
    .includes(notice.replace(/\s+/g, " "));

export function extractBalancedAnnotation(source, markerIndex) {
  const openIndex = source.indexOf("(", markerIndex);
  if (openIndex < 0)
    return source.slice(markerIndex, source.indexOf("\n", markerIndex));

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character !== ")") continue;
    depth -= 1;
    if (depth === 0) return source.slice(markerIndex, index + 1);
  }

  return source.slice(markerIndex);
}

export function extractDeprecationBlock(source, markerIndex, marker) {
  if (marker === "@deprecated") {
    const start = source.lastIndexOf("/**", markerIndex);
    const previousEnd = source.lastIndexOf("*/", markerIndex);
    const end = source.indexOf("*/", markerIndex);
    if (start < 0 || end < 0 || previousEnd > start) return "";
    return source.slice(start, end + 2);
  }

  if (marker === "## @deprecated") {
    const lines = source.split(/\r?\n/);
    const markerLine = lineNumberAt(source, markerIndex) - 1;
    let start = markerLine;
    let end = markerLine;
    while (start > 0 && lines[start - 1].trimStart().startsWith("##")) {
      start -= 1;
    }
    while (
      end + 1 < lines.length &&
      lines[end + 1].trimStart().startsWith("##")
    ) {
      end += 1;
    }
    return lines.slice(start, end + 1).join("\n");
  }

  const annotation = extractBalancedAnnotation(source, markerIndex);
  if (
    marker.startsWith("[") &&
    source[markerIndex + annotation.length] === "]"
  ) {
    return `${annotation}]`;
  }
  return annotation;
}

export function findAttachedDeprecationBlock(
  source,
  declaration,
  marker,
  occurrence = 0,
) {
  const flags = declaration.flags.includes("g")
    ? declaration.flags
    : `${declaration.flags}g`;
  const matcher = new RegExp(declaration.source, flags);
  let match = null;
  for (let index = 0; index <= occurrence; index += 1) {
    match = matcher.exec(source);
    if (!match) break;
  }
  if (!match || match.index === undefined) return null;

  const declarationIndex = match.index;
  const markerIndex = source.lastIndexOf(marker, declarationIndex);
  if (markerIndex < 0) return null;
  const block = extractDeprecationBlock(source, markerIndex, marker);
  if (!block) return null;

  const blockStart = source.lastIndexOf(block, markerIndex);
  if (blockStart < 0) return null;
  const blockEnd = blockStart + block.length;
  if (blockEnd > declarationIndex) return null;
  if (source.slice(blockEnd, declarationIndex).trim().length > 0) return null;
  return block;
}

export function collectMissingGeneratedDeprecationReasons(
  entries,
  source,
  omittedKinds = new Set(),
) {
  return entries.filter(
    (entry) => !omittedKinds.has(entry.kind) && !source.includes(entry.reason),
  );
}

export function matchesForbiddenSourcePattern(source, pattern) {
  pattern.lastIndex = 0;
  return pattern.test(source);
}

export function collectDeprecationScheduleDrift() {
  const failures = [];
  const schemaSources = SCHEMA_FILE_NAMES.map((fileName) => ({
    sourceId: fileName,
    sdl: fs.readFileSync(path.join(root, "packages/gql/src", fileName), "utf8"),
  }));
  const schemaDeprecations = extractSchemaDeprecations(schemaSources);
  for (const issue of schemaDeprecations.issues) {
    failures.push(
      `${issue.file}${issue.line ? `:${issue.line}` : ""}: ${issue.message}`,
    );
  }

  for (const { sourceId: fileName, sdl: source } of schemaSources) {
    const directivePattern = /@(?:deprecated|openiapDeprecated)\s*\(/g;
    for (const match of source.matchAll(directivePattern)) {
      const index = match.index ?? 0;
      const lineStart = source.lastIndexOf("\n", index) + 1;
      const lineEnd = source.indexOf("\n", index);
      const line = source.slice(
        lineStart,
        lineEnd < 0 ? source.length : lineEnd,
      );
      if (/\bdirective\s+@openiapDeprecated/.test(line)) continue;
      const block = extractDeprecationBlock(source, index, match[0]);
      if (containsNotice(block, OPENIAP_3_REMOVAL_NOTICE)) continue;
      failures.push(
        `packages/gql/src/${fileName}:${lineNumberAt(source, index)}: schema deprecation is missing ${JSON.stringify(OPENIAP_3_REMOVAL_NOTICE)}`,
      );
    }
  }

  for (const rule of scanRules) {
    for (const relativeRoot of rule.roots) {
      for (const file of walk(path.join(root, relativeRoot), rule.extensions)) {
        if (rule.excludedNames.has(path.basename(file))) continue;
        const source = fs.readFileSync(file, "utf8");
        const relativeFile = path.relative(root, file);
        const requiredNotice =
          rule.noticeOverrides?.get(relativeFile) ?? rule.notice;
        let markerIndex = source.indexOf(rule.marker);
        while (markerIndex >= 0) {
          const block = extractDeprecationBlock(
            source,
            markerIndex,
            rule.marker,
          );
          if (containsNotice(block, requiredNotice)) {
            markerIndex = source.indexOf(
              rule.marker,
              markerIndex + rule.marker.length,
            );
            continue;
          }
          failures.push(
            `${relativeFile}:${lineNumberAt(source, markerIndex)}: ${rule.label} deprecation is missing ${JSON.stringify(requiredNotice)}`,
          );
          markerIndex = source.indexOf(
            rule.marker,
            markerIndex + rule.marker.length,
          );
        }
      }
    }
  }

  for (const file of new Set(
    requiredSourceNotices.map((entry) => entry.file),
  )) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const value of collectMissingRequiredSourceNotices(file, source)) {
      failures.push(
        `${file}: missing deprecation schedule evidence ${JSON.stringify(value)}`,
      );
    }
  }

  for (const requirement of forbiddenSourcePatterns) {
    const source = fs.readFileSync(path.join(root, requirement.file), "utf8");
    if (!matchesForbiddenSourcePattern(source, requirement.pattern)) continue;
    failures.push(`${requirement.file}: ${requirement.label}`);
  }

  for (const file of new Set(sourceStructureRules.map((rule) => rule.file))) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const label of collectSourceStructureViolations(file, source)) {
      failures.push(`${file}: ${label}`);
    }
  }

  for (const output of generatedDeprecationOutputs) {
    const source = fs.readFileSync(path.join(root, output.file), "utf8");
    for (const entry of collectMissingGeneratedDeprecationReasons(
      schemaDeprecations.entries,
      source,
      output.omittedKinds,
    )) {
      failures.push(
        `${output.file}: generated deprecation for ${entry.ownerPath} is missing schema reason ${JSON.stringify(entry.reason)}`,
      );
    }
  }

  for (const requirement of requiredPublicSymbolNotices) {
    const source = fs.readFileSync(path.join(root, requirement.file), "utf8");
    const block = findAttachedDeprecationBlock(
      source,
      requirement.declaration,
      requirement.marker,
      requirement.occurrence ?? 0,
    );
    const expectedReplacements =
      requirement.replacements ?? [requirement.replacement].filter(Boolean);
    if (
      block &&
      containsNotice(block, requirement.notice) &&
      expectedReplacements.every((replacement) =>
        containsNotice(block, replacement),
      )
    ) {
      continue;
    }
    failures.push(
      `${requirement.file}: ${requirement.symbol} must have an attached ${requirement.marker} notice naming ${JSON.stringify(requirement.notice)}${
        expectedReplacements.length > 0
          ? ` and replacement tokens ${JSON.stringify(expectedReplacements)}`
          : ""
      }`,
    );
  }

  return failures;
}

function main() {
  const failures = collectDeprecationScheduleDrift();
  if (failures.length > 0) {
    console.error(
      `audit-deprecation-schedule: ${failures.length} failure(s)\n\n${failures
        .map((failure) => `- ${failure}`)
        .join("\n")}`,
    );
    process.exit(1);
  }
  console.log("audit-deprecation-schedule: clean");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
