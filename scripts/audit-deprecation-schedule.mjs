#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSchemaDeprecations } from "../packages/gql/schema-deprecations.mjs";
import { SCHEMA_FILE_NAMES } from "../packages/gql/schema-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_EXTENSIONS = new Set([
  ".cs",
  ".dart",
  ".gd",
  ".graphql",
  ".kt",
  ".m",
  ".mm",
  ".swift",
  ".ts",
  ".tsx",
]);

const IGNORED_SEGMENTS = new Set([
  ".build",
  ".dart_tool",
  ".gradle",
  "build",
  "DerivedData",
  "node_modules",
  "obj",
]);

export const completedRemovalRules = [
  {
    label: "shared schema and generated contracts",
    roots: [
      "packages/gql/src",
      "packages/apple/Sources/Models/Types.swift",
      "packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt",
      "libraries/react-native-iap/src/types.ts",
      "libraries/expo-iap/src/types.ts",
      "libraries/flutter_inapp_purchase/lib/types.dart",
      "libraries/godot-iap/addons/godot-iap/types.gd",
      "libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt",
      "libraries/maui-iap/src/OpenIap.Maui/Types.cs",
    ],
    excluded: [
      "packages/gql/src/deprecation-transformer.test.ts",
      "packages/gql/src/schema-deprecations.test.mjs",
      "packages/gql/src/generated-compatibility.test.ts",
      "packages/gql/src/schema-linter.test.ts",
    ],
    tokens: [
      "validateReceipt",
      "validateReceiptIOS",
      "getStorefrontIOS",
      "requestPurchaseOnPromotedProductIOS",
      "checkAlternativeBillingAvailabilityAndroid",
      "showAlternativeBillingDialogAndroid",
      "createAlternativeBillingTokenAndroid",
      "useAlternativeBilling",
      "alternativeBillingModeAndroid",
      "ReceiptValidationProps",
      "ReceiptValidationResult",
      "SubscriptionOfferIOS",
      "DiscountOfferIOS",
      "DiscountIOS",
      "ProductAndroidOneTimePurchaseOfferDetail",
      "ProductSubscriptionAndroidOfferDetails",
      "oneTimePurchaseOfferDetailsAndroid",
      "subscriptionOfferDetailsAndroid",
      "subscriptionInfoIOS",
      "discountsIOS",
      "willExpireSoon",
      "AlternativeBillingModeAndroid",
      "ExternalOfferAvailabilityResultAndroid",
      "ExternalOfferReportingDetailsAndroid",
      "receipt-failed",
      "receipt-finished",
      "receipt-finished-failed",
      "Scheduled for removal in OpenIAP 3.0.",
    ],
  },
  {
    label: "openiap-apple",
    roots: ["packages/apple/Sources", "packages/apple/Example"],
    tokens: [
      "ReceiptValidationCompat",
      "ReceiptValidationProps",
      "ReceiptValidationResult",
      "OpenIapErrorCode",
      "OpenIapEvent",
      "OpenIapPlatform",
      "getStorefrontIOSWithCompletion",
      "requestPurchaseOnPromotedProductIOSWithCompletion",
      "deepLinkToSubscriptionsIOS",
      "gqlVersion",
      "legacy native payload",
    ],
  },
  {
    label: "openiap-google",
    roots: ["packages/google/openiap/src", "packages/google/Example"],
    tokens: [
      "ReceiptValidationProps",
      "ReceiptValidationResult",
      "setUserChoiceBillingListener",
      "checkAlternativeBillingAvailability",
      "showAlternativeBillingInformationDialog",
      "createAlternativeBillingReportingToken",
      "OpenIapError.InvalidReceipt",
      "fun d(",
      "fun i(",
      "fun w(",
      "fun e(",
      "com.meta.horizon.platform.ovr.OCULUS_APP_ID",
      "com.meta.horizon.platform.ovr.HORIZON_APP_ID",
      "com.oculus.vr.APP_ID",
    ],
  },
  {
    label: "react-native-iap",
    roots: [
      "libraries/react-native-iap/src",
      "libraries/react-native-iap/example",
    ],
    tokens: [
      "requestPromotedProductIOS",
      "getReceiptIOS",
      "requestPurchaseOnPromotedProductIOS",
      "alternativeBillingModeAndroid",
      "useAlternativeBilling",
      "request.ios",
      "request.android",
      "legacy native payloads used id",
    ],
  },
  {
    label: "expo-iap",
    roots: [
      "libraries/expo-iap/src",
      "libraries/expo-iap/plugin/src",
      "libraries/expo-iap/android/src/main",
      "libraries/expo-iap/ios",
      "libraries/expo-iap/example",
    ],
    tokens: [
      "getReceiptIOS",
      "validateReceiptAndroid",
      "requestPurchaseOnPromotedProductIOS",
      "alternativeBillingModeAndroid",
      "useAlternativeBilling",
      "request.ios",
      "request.android",
      "skuArr",
      "offerTokenArr",
      "config.iosAlternativeBilling",
      "config.horizonAppId",
    ],
  },
  {
    label: "flutter_inapp_purchase",
    roots: [
      "libraries/flutter_inapp_purchase/lib",
      "libraries/flutter_inapp_purchase/android/src/main",
      "libraries/flutter_inapp_purchase/ios",
      "libraries/flutter_inapp_purchase/macos",
      "libraries/flutter_inapp_purchase/example",
    ],
    tokens: [
      "class ReplacementMode",
      "class ReplaceMode",
      "TypeInApp",
      "ConnectionResult",
      "getAvailableItemsByType",
      "getPurchaseHistoryByType",
      "buyItemByType",
      "consumeProduct",
      "getAppTransaction(",
      "getSubscriptionStatus(",
      "requestPurchaseOnPromotedProductIOS",
      "originalJsonAndroid",
      "transactionStateIOS",
      "transactionReceipt",
      "skuArr",
      "offerTokenArr",
      "transactionIdentifier",
      "replacementModeAndroid",
      "useAlternativeBilling",
    ],
  },
  {
    label: "godot-iap",
    roots: [
      "libraries/godot-iap/addons/godot-iap",
      "libraries/godot-iap/android/src/main",
      "libraries/godot-iap/ios-gdextension/Sources",
      "libraries/godot-iap/Example",
    ],
    excluded: ["libraries/godot-iap/Example/tests/test_envelope_parsing.gd"],
    tokens: [
      "get_storefront_ios",
      "validate_receipt",
      "request_purchase_on_promoted_product_ios",
      "check_alternative_billing_availability_android",
      "show_alternative_billing_dialog_android",
      "create_alternative_billing_token_android",
      "requestPurchaseJson",
      "skuArr",
      "offerTokenArr",
      "replacementModeAndroid",
    ],
  },
  {
    label: "kmp-iap",
    roots: [
      "libraries/kmp-iap/library/src",
      "libraries/kmp-iap/example",
      "libraries/kmp-iap/README.md",
    ],
    extensions: new Set([...SOURCE_EXTENSIONS, ".md"]),
    excluded: [
      "libraries/kmp-iap/library/src/androidUnitTest",
      "libraries/kmp-iap/library/src/commonTest",
      "libraries/kmp-iap/library/src/iosTest",
    ],
    tokens: [
      "requestPurchaseOnPromotedProductIOS",
      "getStorefrontIOS",
      "validateReceiptIOS",
      "validateReceipt(",
      "fun ios(",
      "fun android(",
      "ios {",
      "android {",
      "replacementMode(",
      "useAlternativeBilling",
      "alternativeBillingModeAndroid",
    ],
  },
  {
    label: "OpenIap.Maui",
    roots: ["libraries/maui-iap/src", "libraries/maui-iap/example"],
    tokens: [
      "RequestPurchaseOnPromotedProductIOSAsync",
      "ReceiptValidationProps",
      "ReceiptValidationResult",
      "purchaseEnv.IOS",
      "subEnv.IOS",
    ],
  },
];

export const activeDocsForbiddenTokens = [
  "AlternativeBillingMode",
  "AlternativeBillingModeAndroid",
  "DiscountIOS",
  "DiscountOfferIOS",
  "ExternalOfferAvailabilityResultAndroid",
  "ExternalOfferReportingDetailsAndroid",
  "ProductAndroidOneTimePurchaseOfferDetail",
  "ProductSubscriptionAndroidOfferDetails",
  "ReceiptFailed",
  "ReceiptFinished",
  "ReceiptFinishedFailed",
  "ReceiptValidationProps",
  "ReceiptValidationResult",
  "SubscriptionOfferIOS",
  "validateReceipt",
  "validateReceiptIOS",
  "getStorefrontIOS",
  "requestPurchaseOnPromotedProductIOS",
  "checkAlternativeBillingAvailabilityAndroid",
  "showAlternativeBillingDialogAndroid",
  "createAlternativeBillingTokenAndroid",
  "alternativeBillingModeAndroid",
  "useAlternativeBilling",
  "subscriptionOfferDetailsAndroid",
  "oneTimePurchaseOfferDetailsAndroid",
  "subscriptionInfoIOS",
  "discountsIOS",
  "willExpireSoon",
  "transactionReceipt",
  "originalJsonAndroid",
  "transactionStateIOS",
  "replacementModeAndroid",
  "com.meta.horizon.platform.ovr.OCULUS_APP_ID",
  "com.meta.horizon.platform.ovr.HORIZON_APP_ID",
  "com.oculus.vr.APP_ID",
];

const activeDocsRoots = ["packages/docs/src"];
const activeDocsExcluded = [
  "packages/docs/src/pages/docs/index.tsx",
  "packages/docs/src/pages/docs/apis/index.tsx",
  "packages/docs/src/pages/docs/updates/announcements.tsx",
  "packages/docs/src/pages/docs/updates/deprecations.tsx",
  "packages/docs/src/pages/docs/updates/releases.tsx",
];

const forbiddenFiles = [
  "packages/apple/Sources/Models/TypeAliases.swift",
  "packages/apple/Sources/ReceiptValidationCompat.swift",
  "libraries/react-native-iap/src/utils/deprecation.ts",
  "libraries/react-native-iap/src/utils/platform-request.ts",
  "libraries/expo-iap/src/utils/deprecation.ts",
  "libraries/flutter_inapp_purchase/lib/deprecation.dart",
  "libraries/maui-iap/src/OpenIap.Maui/Iap.cs",
];

const requiredTexts = [
  {
    file: "knowledge/internal/07-docs-consistency.md",
    values: [
      "Major removals leave one canonical contract",
      "`react-native-iap` 16.0.0",
      "`expo-iap` 5.0.0",
      "`flutter_inapp_purchase` 10.0.0",
      "`godot-iap` 3.0.0",
      "`kmp-iap` 3.0.0",
      "`OpenIap.Maui` 2.0.0",
      "/docs/updates/deprecations",
      "Historical release notes, migration catalogs, archives, and URL",
      "internal React Native, Expo, KMP, or Godot native-response",
    ],
  },
  {
    file: "packages/docs/src/pages/docs/updates/deprecations.tsx",
    values: [
      "Breaking major release:",
      "Last compatible major",
      "Removed in",
      "react-native-iap 16.0.0",
      "expo-iap 5.0.0",
      "flutter_inapp_purchase 10.0.0",
      "godot-iap 3.0.0",
      "kmp-iap 3.0.0",
      "OpenIap.Maui 2.0.0",
      "Removed schema migration catalog",
      "Removed package-specific compatibility shims",
      "ProductAndroid.oneTimePurchaseOfferDetailsAndroid",
      "ProductSubscriptionAndroid.oneTimePurchaseOfferDetailsAndroid",
      "ProductAndroid.subscriptionOfferDetailsAndroid / ProductSubscriptionAndroid.subscriptionOfferDetailsAndroid",
      "ProductSubscriptionAndroid.discountOffers",
    ],
  },
  {
    file: "packages/docs/src/pages/docs/updates/releases.tsx",
    values: [
      "OpenIAP major API cleanup",
      "OpenIAP Spec 3.0.0",
      "openiap-apple 3.0.0",
      "openiap-google 3.0.0",
      "react-native-iap 16.0.0",
      "expo-iap 5.0.0",
      "flutter_inapp_purchase 10.0.0",
      "godot-iap 3.0.0",
      "kmp-iap 3.0.0",
      "OpenIap.Maui 2.0.0",
      "Package Releases",
      "The removed outbound",
      "SSE surface is not restored",
    ],
  },
  {
    file: "scripts/agent/compile-context.ts",
    values: [
      "expose only the canonical",
      "`react-native-iap\\` 16.0.0",
      "`expo-iap\\` 5.0.0",
      "`flutter_inapp_purchase\\` 10.0.0",
      "`godot-iap\\` 3.0.0",
      "`kmp-iap\\` 3.0.0",
      "`OpenIap.Maui\\` 2.0.0",
      "Historical redirects remain only to route",
    ],
  },
];

const normalize = (value) => value.split(path.sep).join("/");

const isExcluded = (relativePath, excluded) =>
  excluded.some(
    (entry) =>
      relativePath === entry ||
      relativePath.startsWith(`${entry.replace(/\/$/, "")}/`),
  );

const isTestPath = (relativePath) =>
  /(?:^|\/)(?:tests?|__tests__|test[^/]*)(?:\/|$)/i.test(relativePath) ||
  /\.(?:spec|test)\.[^.]+$/.test(relativePath);

const walkFiles = (entry) => {
  const absolute = path.join(root, entry);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) return [normalize(entry)];

  const files = [];
  for (const child of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (IGNORED_SEGMENTS.has(child.name)) continue;
    files.push(...walkFiles(path.join(entry, child.name)));
  }
  return files;
};

const lineNumberAt = (source, index) =>
  source.slice(0, index).split("\n").length;

export const collectForbiddenMatches = ({
  roots,
  tokens,
  excluded = [],
  extensions = SOURCE_EXTENSIONS,
}) => {
  const matches = [];
  const files = [...new Set(roots.flatMap(walkFiles))];

  for (const file of files) {
    if (isExcluded(file, excluded)) continue;
    if (isTestPath(file)) continue;
    if (!extensions.has(path.extname(file))) continue;
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const token of tokens) {
      let index = source.indexOf(token);
      while (index !== -1) {
        matches.push({ file, line: lineNumberAt(source, index), token });
        index = source.indexOf(token, index + token.length);
      }
    }
  }
  return matches;
};

export const collectMissingRequiredTexts = (requirements = requiredTexts) => {
  const missing = [];
  for (const requirement of requirements) {
    const file = path.join(root, requirement.file);
    const source = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    for (const value of requirement.values) {
      if (!source.includes(value))
        missing.push({ file: requirement.file, value });
    }
  }
  return missing;
};

export const collectRepositorySchemaDeprecations = () => {
  const sources = SCHEMA_FILE_NAMES.map((sourceId) => ({
    sourceId,
    sdl: fs.readFileSync(path.join(root, "packages/gql/src", sourceId), "utf8"),
  }));
  return extractSchemaDeprecations(sources);
};

export const collectCompletedRemovalFailures = () => {
  const failures = [];
  const schemaDeprecations = collectRepositorySchemaDeprecations();
  for (const issue of schemaDeprecations.issues) {
    failures.push(
      `${issue.file}:${issue.line ?? 1}: invalid schema deprecation metadata: ${issue.message}`,
    );
  }
  for (const entry of schemaDeprecations.entries) {
    failures.push(
      `${entry.file}:${entry.line ?? 1}: completed major train must not retain schema deprecation ${entry.ownerPath}`,
    );
  }

  for (const rule of completedRemovalRules) {
    for (const match of collectForbiddenMatches(rule)) {
      failures.push(
        `${match.file}:${match.line}: ${rule.label} still contains removed token ${JSON.stringify(match.token)}`,
      );
    }
  }

  for (const match of collectForbiddenMatches({
    roots: activeDocsRoots,
    excluded: activeDocsExcluded,
    tokens: activeDocsForbiddenTokens,
  })) {
    failures.push(
      `${match.file}:${match.line}: active docs still teach removed token ${JSON.stringify(match.token)}`,
    );
  }

  for (const missing of collectMissingRequiredTexts()) {
    failures.push(
      `${missing.file}: missing major-removal documentation ${JSON.stringify(missing.value)}`,
    );
  }

  for (const file of forbiddenFiles) {
    if (fs.existsSync(path.join(root, file))) {
      failures.push(`${file}: removed compatibility file still exists`);
    }
  }

  return failures;
};

export const runAudit = () => {
  const failures = collectCompletedRemovalFailures();
  if (failures.length > 0) {
    console.error("Deprecated API removal audit failed:\n");
    for (const failure of failures) console.error(`- ${failure}`);
    return false;
  }

  console.log(
    `Deprecated API removal audit passed (${completedRemovalRules.length} source groups, ${activeDocsForbiddenTokens.length} active-doc tokens).`,
  );
  return true;
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain && !runAudit()) process.exitCode = 1;
