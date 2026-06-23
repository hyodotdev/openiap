#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const EXPO_EXAMPLE_ROOT = 'libraries/expo-iap/example';

const parityCoveredLibraries = new Set([
  'expo-iap',
  'flutter_inapp_purchase',
  'kmp-iap',
  'maui-iap',
  'react-native-iap',
]);

const parityExcludedLibraries = new Set([
  // Godot is intentionally excluded until its example parity is brought back
  // into the same automated build/test lane as the other SDK examples.
  'godot-iap',
]);

const featureSpecs = {
  'all-products': {},
  'purchase-flow': {},
  'subscription-flow': {},
  'available-purchases': {},
  'offer-code': {},
  'alternative-billing': {},
  'webhook-stream': {},
};

const operationParityRegistry = {
  Mutation: [
    'acknowledgePurchaseAndroid',
    'beginRefundRequestIOS',
    'checkAlternativeBillingAvailabilityAndroid',
    'clearTransactionIOS',
    'consumePurchaseAndroid',
    'createAlternativeBillingTokenAndroid',
    'createBillingProgramReportingDetailsAndroid',
    'deepLinkToSubscriptions',
    'endConnection',
    'finishTransaction',
    'initConnection',
    'isBillingProgramAvailableAndroid',
    'launchExternalLinkAndroid',
    'presentCodeRedemptionSheetIOS',
    'presentExternalPurchaseLinkIOS',
    'presentExternalPurchaseNoticeSheetIOS',
    'requestPurchase',
    'requestPurchaseOnPromotedProductIOS',
    'restorePurchases',
    'showAlternativeBillingDialogAndroid',
    'showExternalPurchaseCustomLinkNoticeIOS',
    'showManageSubscriptionsIOS',
    'syncIOS',
    'validateReceipt',
    'verifyPurchase',
    'verifyPurchaseWithProvider',
  ],
  Query: [
    'canPresentExternalPurchaseNoticeIOS',
    'currentEntitlementIOS',
    'fetchProducts',
    'getActiveSubscriptions',
    'getAllTransactionsIOS',
    'getAppTransactionIOS',
    'getAvailablePurchases',
    'getExternalPurchaseCustomLinkTokenIOS',
    'getPendingTransactionsIOS',
    'getPromotedProductIOS',
    'getReceiptDataIOS',
    'getStorefront',
    'getStorefrontIOS',
    'getTransactionJwsIOS',
    'hasActiveSubscriptions',
    'isEligibleForExternalPurchaseCustomLinkIOS',
    'isEligibleForIntroOfferIOS',
    'isTransactionVerifiedIOS',
    'latestTransactionIOS',
    'subscriptionStatusIOS',
    'validateReceiptIOS',
  ],
  Subscription: [
    'developerProvidedBillingAndroid',
    'promotedProductIOS',
    'purchaseError',
    'purchaseUpdated',
    'subscriptionBillingIssue',
    'userChoiceBillingAndroid',
  ],
};

const requiredIds = discoverExpoProductIds();
const routes = Object.keys(featureSpecs);

function rel(...parts) {
  return path.join(...parts);
}

function abs(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(abs(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(abs(relativePath));
}

function fail(message) {
  failures.push(message);
}

function listDirectories(relativePath) {
  if (!exists(relativePath)) return [];
  return fs
    .readdirSync(abs(relativePath), {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function expectFile(relativePath) {
  if (!exists(relativePath)) fail(`missing file: ${relativePath}`);
}

function expectIncludes(relativePath, needles, label = relativePath) {
  expectFile(relativePath);
  if (!exists(relativePath)) return;
  const text = read(relativePath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${label} is missing ${JSON.stringify(needle)}`);
    }
  }
}

function expectNotIncludes(relativePath, needles, label = relativePath) {
  expectFile(relativePath);
  if (!exists(relativePath)) return;
  const text = read(relativePath);
  for (const needle of needles) {
    if (text.includes(needle)) {
      fail(`${label} must not include ${JSON.stringify(needle)}`);
    }
  }
}

function expectOptionalIncludes(relativePath, needles, label = relativePath) {
  if (!exists(relativePath)) return;
  expectIncludes(relativePath, needles, label);
}

function expectOptionalNotIncludes(relativePath, needles, label = relativePath) {
  if (!exists(relativePath)) return;
  expectNotIncludes(relativePath, needles, label);
}

function expectSameFile(sourcePath, targetPath, label = targetPath, normalize = (value) => value) {
  expectFile(sourcePath);
  expectFile(targetPath);
  if (!exists(sourcePath) || !exists(targetPath)) return;
  const source = normalize(read(sourcePath));
  const target = normalize(read(targetPath));
  if (source !== target) {
    fail(`${label} is not synced with ${sourcePath}`);
  }
}

function expectSymlinkTarget(relativePath, expectedTarget, label = relativePath) {
  expectFile(relativePath);
  if (!exists(relativePath)) return;
  const stat = fs.lstatSync(abs(relativePath));
  if (!stat.isSymbolicLink()) {
    fail(`${label} must be a symlink to ${expectedTarget}`);
    return;
  }
  const actualTarget = fs.readlinkSync(abs(relativePath));
  if (actualTarget !== expectedTarget) {
    fail(`${label} points to ${actualTarget}, expected ${expectedTarget}`);
  }
}

function expectSameSet(label, ssotValues, registryValues) {
  const ssot = new Set(ssotValues);
  const registry = new Set(registryValues);
  const missing = [...ssot].filter((value) => !registry.has(value)).sort();
  const stale = [...registry].filter((value) => !ssot.has(value)).sort();

  if (missing.length > 0) {
    fail(`${label} missing parity registry coverage: ${missing.join(', ')}`);
  }
  if (stale.length > 0) {
    fail(`${label} parity registry has stale entries: ${stale.join(', ')}`);
  }
}

function uniqueMatches(text, regex) {
  return [...new Set([...text.matchAll(regex)].map((match) => match[1]))].sort();
}

function discoverExpoProductIds() {
  const constantsPath = rel(EXPO_EXAMPLE_ROOT, 'src/utils/constants.ts');
  expectFile(constantsPath);
  if (!exists(constantsPath)) return [];
  const ids = [...new Set(read(constantsPath).match(/dev\.hyo\.martie\.[A-Za-z0-9._-]+/g) ?? [])].sort();
  if (ids.length === 0) {
    fail(`${constantsPath} does not declare any SSOT example product IDs`);
  }
  return ids;
}

function discoverExpoRoutes() {
  const appDir = rel(EXPO_EXAMPLE_ROOT, 'app');
  if (!exists(appDir)) {
    fail(`missing Expo SSOT app directory: ${appDir}`);
    return [];
  }

  return fs
    .readdirSync(abs(appDir), {withFileTypes: true})
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => entry.name.replace(/\.tsx$/, ''))
    .filter((route) => !['_layout', 'index', '+not-found'].includes(route))
    .sort();
}

function parseGeneratedOperations(kind) {
  const sourcePath = 'packages/gql/src/generated/types.ts';
  expectFile(sourcePath);
  if (!exists(sourcePath)) return [];
  const match = read(sourcePath).match(new RegExp(`export interface ${kind} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) {
    fail(`${sourcePath} is missing export interface ${kind}`);
    return [];
  }
  return [...match[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*)\??:\s/gm)]
    .map((item) => item[1])
    .sort();
}

function parseKotlinResolverOperations(relativePath, kind) {
  expectFile(relativePath);
  if (!exists(relativePath)) return [];
  const match = read(relativePath).match(
    new RegExp(`public interface ${kind}Resolver\\s*\\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match) {
    fail(`${relativePath} is missing public interface ${kind}Resolver`);
    return [];
  }
  return [...match[1].matchAll(/^\s+suspend fun ([A-Za-z][A-Za-z0-9_]*)\(/gm)]
    .map((item) => item[1])
    .sort();
}

function kmpGeneratedKotlin(text) {
  if (!/\bpackage io\.github\.hyochan\.kmpiap\.openiap\b/.test(text)) {
    const lines = text.split('\n');
    let lastFileAnnotation = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('@file:')) lastFileAnnotation = i;
    }
    if (lastFileAnnotation >= 0) {
      lines.splice(lastFileAnnotation + 1, 0, '', 'package io.github.hyochan.kmpiap.openiap');
    } else {
      lines.unshift('package io.github.hyochan.kmpiap.openiap', '');
    }
    text = lines.join('\n');
  }

  return text.replace(
    /(\n\s*\w+\([^)]*\))\n\n(\s+companion object)/g,
    '$1;\n\n$2',
  );
}

function checkLibraryCoverageRegistry() {
  const discovered = listDirectories('libraries');
  for (const library of discovered) {
    if (parityCoveredLibraries.has(library) || parityExcludedLibraries.has(library)) {
      continue;
    }
    fail(
      `new library is not covered by SSOT parity audit: libraries/${library}. ` +
        `Add it to scripts/audit-non-godot-parity.mjs or explicitly exclude it.`,
    );
  }

  for (const library of parityCoveredLibraries) {
    if (!discovered.includes(library)) {
      fail(`parity-covered library is missing: libraries/${library}`);
    }
  }
}

function checkExpoSsotRegistry() {
  expectSameSet('Expo example route', discoverExpoRoutes(), routes);
  if (requiredIds.length === 0) {
    fail('Expo example product ID registry is empty');
  }
}

function checkGeneratedTypeSync() {
  expectSameFile(
    'packages/gql/src/generated/types.ts',
    'libraries/expo-iap/src/types.ts',
    'Expo generated TypeScript types',
  );
  expectSameFile(
    'packages/gql/src/generated/types.ts',
    'libraries/react-native-iap/src/types.ts',
    'React Native generated TypeScript types',
  );
  expectSameFile(
    'packages/gql/src/webhook-client.ts',
    'libraries/expo-iap/src/webhook-client.ts',
    'Expo webhook client helper',
  );
  expectSameFile(
    'packages/gql/src/webhook-client.ts',
    'libraries/react-native-iap/src/webhook-client.ts',
    'React Native webhook client helper',
  );
  expectSameFile(
    'packages/gql/src/kit-api.ts',
    'libraries/expo-iap/src/kit-api.ts',
    'Expo IAPKit API helper',
  );
  expectSameFile(
    'packages/gql/src/kit-api.ts',
    'libraries/react-native-iap/src/kit-api.ts',
    'React Native IAPKit API helper',
  );
  expectSameFile(
    'packages/gql/src/generated/types.dart',
    'libraries/flutter_inapp_purchase/lib/types.dart',
    'Flutter generated Dart types',
  );
  expectSameFile(
    'packages/gql/src/generated/Types.swift',
    'packages/apple/Sources/Models/Types.swift',
    'Apple generated Swift types',
  );
  expectSameFile(
    'packages/gql/src/generated/Types.cs',
    'libraries/maui-iap/src/OpenIap.Maui/Types.cs',
    'MAUI generated C# types',
  );
  expectSameFile(
    'packages/gql/src/generated/Types.kt',
    'libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt',
    'KMP generated Kotlin types',
    kmpGeneratedKotlin,
  );

  for (const kind of Object.keys(operationParityRegistry)) {
    expectSameSet(
      `Google generated ${kind} operations`,
      parseGeneratedOperations(kind),
      parseKotlinResolverOperations(
        'packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt',
        kind,
      ),
    );
  }
}

function checkGqlRuntimeExports() {
  const packageJson = JSON.parse(read('packages/gql/package.json'));
  const exports = packageJson.exports ?? {};
  for (const [exportPath, filePath] of [
    ['./kit-api', './src/kit-api.ts'],
    ['./webhook-client', './src/webhook-client.ts'],
  ]) {
    if (exports[exportPath] !== filePath) {
      fail(
        `@hyodotdev/openiap-gql export ${exportPath} should point to ${filePath}`,
      );
    }
  }
}

function checkOperationRegistry() {
  for (const [kind, registeredOperations] of Object.entries(operationParityRegistry)) {
    expectSameSet(
      `GQL ${kind} operation`,
      parseGeneratedOperations(kind),
      registeredOperations,
    );
  }
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.gradle' ||
      entry.name === '.dart_tool' ||
      entry.name === 'build' ||
      entry.name === 'bin' ||
      entry.name === 'obj' ||
      entry.name === 'Pods' ||
      entry.name === 'DerivedData'
    ) {
      continue;
    }
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(next, acc);
    else acc.push(next);
  }
  return acc;
}

function expectNoExampleStorefrontIOS() {
  const roots = [
    'libraries/expo-iap/example',
    'libraries/react-native-iap/example',
    'libraries/flutter_inapp_purchase/example',
    'libraries/kmp-iap/example',
    'libraries/maui-iap/example',
    'packages/apple/Example',
    'packages/google/Example',
  ];
  for (const searchRoot of roots) {
    for (const file of walk(abs(searchRoot))) {
      if (!/\.(tsx?|dart|kt|swift|cs|xaml)$/.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes('getStorefrontIOS(')) {
        fail(`example uses getStorefrontIOS instead of getStorefront: ${path.relative(root, file)}`);
      }
    }
  }
}

function checkExpoRouterExample(base, importSource) {
  for (const route of routes) {
    expectFile(rel(base, 'app', `${route}.tsx`));
  }
  expectIncludes(rel(base, 'app/_layout.tsx'), routes.map((route) => `name="${route}"`), `${base} layout`);
  expectIncludes(rel(base, 'app/index.tsx'), routes.map((route) => `/${route}`), `${base} home`);
  expectIncludes(rel(base, 'app/index.tsx'), ['getStorefront'], `${base} home`);
  expectIncludes(rel(base, 'app/webhook-stream.tsx'), [
    'connectWebhookStream',
    'Trigger test',
    '/v1/webhooks/',
    '/v1/webhooks/stream',
  ], `${base} webhook`);
  expectIncludes(rel(base, 'app/alternative-billing.tsx'), [
    'isBillingProgramAvailableAndroid',
    'launchExternalLinkAndroid',
    'createBillingProgramReportingDetailsAndroid',
    'enableBillingProgramAndroid',
  ], `${base} alternative billing`);
  expectNotIncludes(rel(base, 'app/alternative-billing.tsx'), [
    'checkAlternativeBillingAvailabilityAndroid',
    'createAlternativeBillingTokenAndroid',
  ], `${base} alternative billing`);
  expectIncludes(rel(base, importSource), requiredIds, `${base} product constants`);
}

function checkReactNativeClassic() {
  const base = 'libraries/react-native-iap/example';
  const screens = {
    AllProducts: 'AllProducts',
    PurchaseFlow: 'PurchaseFlow',
    SubscriptionFlow: 'SubscriptionFlow',
    AvailablePurchases: 'AvailablePurchases',
    OfferCode: 'OfferCode',
    AlternativeBilling: 'AlternativeBilling',
    WebhookStream: 'WebhookStream',
  };
  for (const [route, file] of Object.entries(screens)) {
    expectFile(rel(base, 'screens', `${file}.tsx`));
    expectIncludes(rel(base, 'navigation/index.tsx'), [`name="${route}"`], `${base} navigation`);
  }
  expectIncludes(rel(base, 'screens/Home.tsx'), [
    'All Products',
    'Purchase Flow',
    'Subscription Flow',
    'Available Purchases',
    'Offer Code',
    'Alternative Billing',
    'Webhook Stream',
  ], `${base} home`);
  expectIncludes(rel(base, 'screens/WebhookStream.tsx'), [
    'connectWebhookStream',
    'Trigger test notification',
    '/v1/webhooks/',
  ], `${base} webhook`);
  expectIncludes(rel(base, 'screens/AlternativeBilling.tsx'), [
    'isBillingProgramAvailableAndroid',
    'launchExternalLinkAndroid',
    'createBillingProgramReportingDetailsAndroid',
    'enableBillingProgramAndroid',
  ], `${base} alternative billing`);
  expectIncludes(rel(base, 'src/utils/constants.ts'), requiredIds, `${base} product constants`);
  expectIncludes(rel(base, '__tests__/screens/Home.test.tsx'), [
    'All Products',
    'Alternative Billing',
    'Webhook Stream',
  ], `${base} home tests`);
  expectIncludes(rel(base, '__tests__/RnIap.test.tsx'), [
    'getStorefront',
    'isBillingProgramAvailableAndroid',
    'launchExternalLinkAndroid',
    'createBillingProgramReportingDetailsAndroid',
  ], `${base} API tests`);
}

function checkFlutter() {
  const base = 'libraries/flutter_inapp_purchase/example';
  const screenFiles = [
    'all_products_screen.dart',
    'purchase_flow_screen.dart',
    'subscription_flow_screen.dart',
    'available_purchases_screen.dart',
    'offer_code_screen.dart',
    'alternative_billing_screen.dart',
    'webhook_stream_screen.dart',
  ];
  for (const file of screenFiles) {
    expectFile(rel(base, 'lib/src/screens', file));
  }
  expectIncludes(rel(base, 'lib/src/app.dart'), routes.map((route) => `/${route}`), `${base} routes`);
  expectIncludes(rel(base, 'lib/src/screens/home_screen.dart'), [
    'All Products',
    'Purchase Flow',
    'Subscription Flow',
    'Available Purchases',
    'Redeem Offer Code',
    'Alternative Billing',
    'Webhook Stream',
  ], `${base} home`);
  expectIncludes(rel(base, 'lib/src/screens/webhook_stream_screen.dart'), [
    'connectWebhookStream',
    'Trigger test',
    '/v1/webhooks/',
  ], `${base} webhook`);
  expectIncludes(rel(base, 'lib/src/screens/alternative_billing_screen.dart'), [
    'isBillingProgramAvailableAndroid',
    'launchExternalLinkAndroid',
    'createBillingProgramReportingDetailsAndroid',
  ], `${base} alternative billing`);
  expectIncludes(rel(base, 'lib/src/constants.dart'), requiredIds, `${base} product constants`);
  expectIncludes(rel(base, 'test/widget_test.dart'), [
    'Webhook Stream',
    'Trigger test',
    'Alternative Billing',
  ], `${base} widget tests`);
  expectIncludes('libraries/flutter_inapp_purchase/lib/utils.dart', [
    'introductoryOfferEligibility',
    'promotionalOfferJWS',
    'winBackOffer',
  ], 'Flutter iOS purchase payload');
  expectIncludes('libraries/flutter_inapp_purchase/test/flutter_inapp_purchase_channel_test.dart', [
    'sends advanced iOS subscription purchase fields',
    'one-time-offer-token',
    'uses Apple channel method on iOS',
    'deepLinkToSubscriptionsAndroid',
  ], 'Flutter requestPurchase tests');
  expectIncludes('libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart', [
    "invokeMethod('deepLinkToSubscriptions')",
    'deepLinkToSubscriptionsAndroid',
  ], 'Flutter deepLinkToSubscriptions bridge');
  const flutterIosPlugin =
    'libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift';
  const flutterMacosPlugin =
    'libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift';

  expectIncludes(flutterIosPlugin, [
    'case "deepLinkToSubscriptions"',
    'OpenIapModule.shared.deepLinkToSubscriptions(nil)',
  ], 'Flutter iOS deepLinkToSubscriptions bridge');
  expectIncludes(flutterMacosPlugin, [
    'case "setPurchaseUpdatedListenerOptions"',
    'case "deepLinkToSubscriptions"',
    'case "getAllTransactionsIOS"',
    'case "validateReceiptIOS", "verifyPurchase"',
    'case "verifyPurchaseWithProvider"',
    'case "isEligibleForExternalPurchaseCustomLinkIOS"',
    'case "getExternalPurchaseCustomLinkTokenIOS"',
    'case "showExternalPurchaseCustomLinkNoticeIOS"',
    'subscriptionBillingIssueListener',
  ], 'Flutter macOS channel parity');
  expectIncludes(
    'libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt',
    ['"setPurchaseUpdatedListenerOptions" ->'],
    'Flutter Android purchase listener option no-op',
  );
  expectNotIncludes('libraries/flutter_inapp_purchase/android/build.gradle', [
    'com.android.billingclient:billing-ktx:',
  ], 'Flutter Android must inherit Play Billing from openiap-google');
  for (const nativePlugin of [
    'libraries/expo-iap/ios/ExpoIapModule.swift',
    flutterIosPlugin,
    flutterMacosPlugin,
  ]) {
    expectNotIncludes(nativePlugin, [
      'OpenIapModule.shared.validateReceiptIOS',
      'OpenIapModule.shared.getStorefrontIOS()',
    ], 'Flutter deprecated native OpenIAP calls');
  }
  expectIncludes(flutterIosPlugin, [
    'OpenIapModule.shared.requestPurchaseOnPromotedProductIOS()',
  ], 'Flutter iOS promoted purchase bridge');
  expectIncludes(flutterMacosPlugin, [
    'OpenIapModule.shared.requestPurchaseOnPromotedProductIOS()',
  ], 'Flutter macOS promoted purchase bridge');
  expectIncludes('libraries/react-native-iap/ios/HybridRnIap.swift', [
    'func buyPromotedProductIOS() throws -> Promise<Void>',
    'OpenIapModule.shared.requestPurchaseOnPromotedProductIOS()',
    'throw OpenIapException.from(purchaseError)',
  ], 'RN iOS promoted purchase bridge');
  expectIncludes('libraries/expo-iap/ios/ExpoIapModule.swift', [
    'throw IapException.from(error)',
    'code: .purchaseVerificationFailed',
    'OpenIapModule.shared.requestPurchaseOnPromotedProductIOS()',
    'try await OpenIapModule.shared.getStorefront()',
  ], 'Expo iOS error/storefront bridge');
  expectIncludes('libraries/expo-iap/ios/onside/OnsideIapModule.swift', [
    'AsyncFunction("setPurchaseUpdatedListenerOptions")',
    'AsyncFunction("getAvailableItems") { (alsoPublish: Bool, onlyIncludeActive: Bool)',
    'AsyncFunction("getStorefront")',
    'getOnsideStorefront()',
    'OnsideEvent.subscriptionBillingIssue.rawValue',
    'constants["ERROR_CODES"] = errorCodes',
  ], 'Expo Onside root API bridge');
  expectNotIncludes('libraries/expo-iap/ios/onside/OnsideIapModule.swift', [
    'private let encoder: JSONEncoder',
  ], 'Expo Onside unused encoder cleanup');
  expectIncludes('libraries/expo-iap/src/index.ts', [
    'nativeModule.USING_ONSIDE_SDK',
    'nativeModule.restorePurchases',
  ], 'Expo Onside restore routing');
  expectIncludes('libraries/expo-iap/src/ExpoIapModule.ts', [
    "const ONSIDE_MARKETPLACE_ID = 'com.onside.marketplace-app'",
    'shouldUseOnsideModule()',
    'onsideModuleUnavailable',
    'return getExpoIapFallbackModule()?.[prop]',
  ], 'Expo Onside native module proxy routing');
  expectIncludes('libraries/expo-iap/src/__tests__/ExpoIapModule.test.ts', [
    're-resolves when Onside availability changes after initial access',
    'does not repeatedly load a missing ExpoIapOnside module',
    'surfaces non-missing ExpoIap fallback errors',
  ], 'Expo Onside module proxy tests');
  expectNotIncludes('libraries/expo-iap/src/index.ts', [
    'v3.1.0',
    'Unsupported Platform',
    'Platform not supported',
  ], 'Expo public API warnings/errors must stay current and consistently phrased');
  expectNotIncludes('libraries/expo-iap/CLAUDE.md', [
    'v2.9.0',
  ], 'Expo package guidance must not reference past deprecation deadlines');
  expectIncludes('libraries/react-native-iap/src/__tests__/index.test.ts', [
    'deepLinkToSubscriptions surfaces iOS native failures',
  ], 'RN deepLinkToSubscriptions error tests');
  expectNotIncludes('libraries/react-native-iap/src/index.ts', [
    "RnIapConsole.warn('[deepLinkToSubscriptions] Failed on iOS:'",
    'getActiveSubscriptions_OLD',
    'v14.4.0',
  ], 'RN deepLinkToSubscriptions error handling');
  expectNotIncludes('libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart', [
    "final androidProps = type == 'inapp'",
  ], 'Flutter Android requestPurchase parser');
}

function checkKmp() {
  const base = 'libraries/kmp-iap/example/composeApp/src';
  for (const file of [
    'AllProductsScreen.kt',
    'PurchaseFlowScreen.kt',
    'SubscriptionFlowScreen.kt',
    'AvailablePurchasesScreen.kt',
    'OfferCodeScreen.kt',
    'AlternativeBillingScreen.kt',
    'WebhookStreamScreen.kt',
    'ExampleProductIds.kt',
    'WebhookTestNotification.kt',
  ]) {
    expectFile(rel(base, 'commonMain/kotlin/dev/hyo/martie/screens', file));
  }
  for (const sourceSet of ['androidMain', 'iosMain', 'jvmMain']) {
    expectFile(rel(base, `${sourceSet}/kotlin/dev/hyo/martie/screens/WebhookTestNotification.${sourceSet.replace('Main', '')}.kt`));
  }
  expectIncludes(rel(base, 'commonMain/kotlin/dev/hyo/martie/navigation/Navigation.kt'), routes, 'KMP navigation');
  expectIncludes(rel(base, 'commonMain/kotlin/dev/hyo/martie/screens/HomeScreen.kt'), [
    'All Products',
    'Purchase Flow',
    'Subscription Flow',
    'Available Purchases',
    'Offer Code',
    'Alternative Billing',
    'Webhook Stream',
    'getStorefront()',
  ], 'KMP home');
  expectIncludes(rel(base, 'commonMain/kotlin/dev/hyo/martie/screens/WebhookStreamScreen.kt'), [
    'connectWebhookStream',
    'triggerWebhookTestNotification',
    'Trigger test notification',
  ], 'KMP webhook');
  expectIncludes(rel(base, 'commonMain/kotlin/dev/hyo/martie/screens/AlternativeBillingScreen.kt'), [
    'isBillingProgramAvailableAndroid',
    'launchExternalLinkAndroid',
    'createBillingProgramReportingDetailsAndroid',
  ], 'KMP alternative billing');
  expectIncludes(rel(base, 'commonMain/kotlin/dev/hyo/martie/screens/ExampleProductIds.kt'), requiredIds, 'KMP product constants');
  expectIncludes('libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt', [
    'requestPurchaseWithPayload(params.toJson().toObjCMap())',
    'requireIosSku(params)',
    'openIapModule.verifyPurchaseWithSku(sku)',
    'filterActiveSubscriptions(result, subscriptionIds)',
  ], 'KMP iOS requestPurchase bridge');
  expectNotIncludes('libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt', [
    'TODO: iOS 15+/18+ options',
    'For now, return a basic result',
  ], 'KMP iOS requestPurchase bridge');
  expectNotIncludes('libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt', [
    'requestPurchaseOnPromotedProductIOS(): Boolean = false',
  ], 'KMP Android promoted product bridge');
  expectIncludes('libraries/kmp-iap/example/gradle.properties', [
    'kotlin.apple.xcodeCompatibility.nowarn=true',
  ], 'KMP example Xcode compatibility warning suppression');
}

function checkApple() {
  const base = 'packages/apple';
  for (const file of [
    'AllProductsView.swift',
    'PurchaseFlowScreen.swift',
    'SubscriptionFlowScreen.swift',
    'AvailablePurchasesScreen.swift',
    'OfferCodeScreen.swift',
    'AlternativeBillingScreen.swift',
    'WebhookStreamScreen.swift',
  ]) {
    expectFile(rel(base, 'Example/OpenIapExample/Screens', file));
  }
  expectIncludes(rel(base, 'Example/OpenIapExample/Screens/HomeScreen.swift'), [
    'AllProductsView',
    'PurchaseFlowScreen',
    'SubscriptionFlowScreen',
    'AvailablePurchasesScreen',
    'OfferCodeScreen',
    'AlternativeBillingScreen',
    'WebhookStreamScreen',
  ], 'Apple home');
  expectIncludes(rel(base, 'Example/OpenIapExample/Screens/WebhookStreamScreen.swift'), [
    '/v1/webhooks/stream/',
    'Trigger Test',
    '/v1/webhooks/',
  ], 'Apple webhook');
  expectIncludes(rel(base, 'Sources/OpenIapProtocol.swift'), [
    'func getStorefront()',
    'func canPresentExternalPurchaseNoticeIOS()',
    'func presentExternalPurchaseNoticeSheetIOS()',
    'func presentExternalPurchaseLinkIOS',
    'func isEligibleForExternalPurchaseCustomLinkIOS()',
    'func getExternalPurchaseCustomLinkTokenIOS',
    'func showExternalPurchaseCustomLinkNoticeIOS',
  ], 'Apple protocol');
  expectIncludes(rel(base, 'Sources/OpenIapStore.swift'), [
    'func getStorefront()',
    'deinit {',
    'module.removeListener(token)',
    'guard listenerTokens.isEmpty else { return }',
    'func canPresentExternalPurchaseNoticeIOS()',
    'func presentExternalPurchaseNoticeSheetIOS()',
    'func presentExternalPurchaseLinkIOS',
    'func isEligibleForExternalPurchaseCustomLinkIOS()',
    'func getExternalPurchaseCustomLinkTokenIOS',
    'func showExternalPurchaseCustomLinkNoticeIOS',
  ], 'Apple store');
  expectIncludes(rel(base, 'Sources/OpenIapModule+ObjC.swift'), [
    'func requestPurchaseWithPayload',
    'OpenIapSerialization.requestPurchaseProps(from: payload)',
    'func getStorefrontWithCompletion',
    'try await requestPurchaseOnPromotedProductIOS()',
  ], 'Apple ObjC purchase bridge');
  expectIncludes(rel(base, 'Tests/OpenIapTests/VerifyPurchaseTests.swift'), [
    'testStorefrontUsesUnifiedProtocolMethod',
    'getStorefrontCallCount',
  ], 'Apple tests');
  expectIncludes(rel(base, 'Example/OpenIapExample/Screens/AllProductsView.swift'), requiredIds, 'Apple product constants');
}

function checkGoogle() {
  const base = 'packages/google';
  for (const file of [
    'AllProductsScreen.kt',
    'PurchaseFlowScreen.kt',
    'SubscriptionFlowScreen.kt',
    'AvailablePurchasesScreen.kt',
    'OfferCodeScreen.kt',
    'AlternativeBillingScreen.kt',
    'WebhookStreamScreen.kt',
  ]) {
    expectFile(rel(base, 'Example/src/main/java/dev/hyo/martie/screens', file));
  }
  expectIncludes(rel(base, 'Example/src/main/java/dev/hyo/martie/screens/HomeScreen.kt'), [
    'all_products',
    'purchase_flow',
    'subscription_flow',
    'available_purchases',
    'offer_code',
    'alternative_billing',
    'webhook_stream',
  ], 'Google home');
  expectIncludes(rel(base, 'Example/src/main/java/dev/hyo/martie/screens/WebhookStreamScreen.kt'), [
    'triggerTestNotification',
    '/v1/webhooks/',
    '/v1/webhooks/stream/',
  ], 'Google webhook');
  for (const flavor of ['play', 'horizon']) {
    expectIncludes(rel(base, `openiap/src/${flavor}/java/dev/hyo/openiap/OpenIapModule.kt`), [
      'getStorefront = { getStorefront() }',
      'checkAlternativeBillingAvailabilityAndroid',
      'createAlternativeBillingTokenAndroid',
      'createBillingProgramReportingDetailsAndroid',
      'isBillingProgramAvailableAndroid',
      'launchExternalLinkAndroid',
      'showAlternativeBillingDialogAndroid',
    ], `Google ${flavor} module handlers`);
  }
  expectIncludes(rel(base, 'Example/src/main/java/dev/hyo/martie/Constants.kt'), requiredIds, 'Google product constants');
  expectIncludes(rel(base, 'openiap/src/test/java/dev/hyo/openiap/BillingProgramAndroidTest.kt'), [
    'external-offer',
    'external-payments',
  ], 'Google Billing Programs tests');
}

function checkMaui() {
  const base = 'libraries/maui-iap/example/OpenIap.Maui.Example';
  for (const page of [
    'AllProductsPage',
    'PurchaseFlowPage',
    'SubscriptionFlowPage',
    'AvailablePurchasesPage',
    'OfferCodePage',
    'AlternativeBillingPage',
    'WebhookStreamPage',
  ]) {
    expectFile(rel(base, 'Pages', `${page}.xaml`));
    expectFile(rel(base, 'Pages', `${page}.xaml.cs`));
  }
  expectIncludes(rel(base, 'Pages/HomePage.xaml'), [
    'All Products',
    'Purchase Flow',
    'Subscription Flow',
    'Available Purchases',
    'Offer Code',
    'Alternative Billing',
    'Webhook Stream',
  ], 'MAUI home');
  expectIncludes(rel(base, 'AppShell.xaml.cs'), routes, 'MAUI routes');
  expectIncludes(rel(base, 'Pages/WebhookStreamPage.xaml.cs'), [
    'ConnectWebhookStream',
    'TriggerButton',
    '/v1/webhooks/',
  ], 'MAUI webhook');
  expectIncludes(rel(base, 'Pages/AlternativeBillingPage.xaml.cs'), [
    'IsBillingProgramAvailableAndroidAsync',
    'LaunchExternalLinkAndroidAsync',
    'CreateBillingProgramReportingDetailsAndroidAsync',
  ], 'MAUI alternative billing');
  expectIncludes(rel(base, 'Constants.cs'), requiredIds, 'MAUI product constants');
  expectIncludes('libraries/maui-iap/src/OpenIap.Maui.Bindings.iOS/ApiDefinition.cs', [
    'requestPurchaseWithPayload:completion:',
    'getStorefrontWithCompletion:',
  ], 'MAUI iOS binding');
  expectIncludes('libraries/maui-iap/src/OpenIap.Maui/Platforms/iOS/OpenIapIOS.cs', [
    'RequestPurchaseWithPayload',
    'RequestPurchasePayload',
    '_module.GetStorefront(cb)',
    'GetActiveSubscriptionsAsync(subscriptionIds)',
  ], 'MAUI iOS requestPurchase bridge');
  expectIncludes('libraries/maui-iap/src/OpenIap.Maui/Platforms/iOS/NSObjectJsonBridge.cs', [
    'JsonObjectToDictionary',
  ], 'MAUI iOS JSON bridge');
}

function checkNativeApis() {
  expectIncludes('libraries/react-native-iap/src/specs/RnIap.nitro.ts', [
    'getStorefront(): Promise<string>',
    'checkAlternativeBillingAvailabilityAndroid(): Promise<boolean>',
    'createAlternativeBillingTokenAndroid',
    'isBillingProgramAvailableAndroid',
    'createBillingProgramReportingDetailsAndroid',
    'launchExternalLinkAndroid',
  ], 'RN native spec');
  expectIncludes('libraries/expo-iap/src/index.ts', [
    'getStorefront',
    'connectWebhookStream',
  ], 'Expo API exports');
  expectIncludes('libraries/flutter_inapp_purchase/lib/types.dart', [
    'Future<String> getStorefront()',
    'Future<bool> checkAlternativeBillingAvailabilityAndroid()',
    'Future<String?> createAlternativeBillingTokenAndroid()',
    'Future<BillingProgramReportingDetailsAndroid> createBillingProgramReportingDetailsAndroid',
    'Future<BillingProgramAvailabilityResultAndroid> isBillingProgramAvailableAndroid',
    'Future<bool> launchExternalLinkAndroid',
  ], 'Flutter generated API');
  expectIncludes('libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt', [
    'suspend fun getStorefront(): String',
    'suspend fun checkAlternativeBillingAvailabilityAndroid(): Boolean',
    'suspend fun createAlternativeBillingTokenAndroid',
    'suspend fun createBillingProgramReportingDetailsAndroid',
    'suspend fun isBillingProgramAvailableAndroid',
    'suspend fun launchExternalLinkAndroid',
  ], 'KMP generated API');
}

function checkFrameworkDependencyHygiene() {
  const versions = readJson('openiap-versions.json');
  const googleVersion = versions.google;
  if (typeof googleVersion !== 'string' || googleVersion.length === 0) {
    fail('openiap-versions.json is missing a google version');
  }
  const googleBuildGradle = read('packages/google/openiap/build.gradle.kts');
  const googleCoroutineVersions = uniqueMatches(
    googleBuildGradle,
    /val\s+coroutinesVersion\s*=\s*"([^"]+)"/g,
  );
  if (googleCoroutineVersions.length !== 1) {
    fail(
      `packages/google must use one Kotlinx Coroutines version, found: ${googleCoroutineVersions.join(', ') || '(none)'}`,
    );
  }
  const googleCoroutinesVersion = googleCoroutineVersions[0];

  for (const [packagePath, versionKey] of [
    ['packages/gql/package.json', 'spec'],
    ['packages/docs/package.json', 'spec'],
    ['packages/google/package.json', 'google'],
    ['packages/apple/package.json', 'apple'],
  ]) {
    const packageVersion = readJson(packagePath).version;
    if (packageVersion !== versions[versionKey]) {
      fail(`${packagePath} version ${packageVersion} must match openiap-versions.json ${versionKey} ${versions[versionKey]}`);
    }
  }
  expectSymlinkTarget(
    'packages/apple/Sources/openiap-versions.json',
    '../../../openiap-versions.json',
    'Apple package version SSOT link',
  );
  expectSymlinkTarget(
    'packages/google/openiap-versions.json',
    '../../openiap-versions.json',
    'Google package version SSOT link',
  );
  for (const libraryVersionLink of [
    'libraries/react-native-iap/openiap-versions.json',
    'libraries/expo-iap/openiap-versions.json',
    'libraries/flutter_inapp_purchase/openiap-versions.json',
    'libraries/godot-iap/openiap-versions.json',
    'libraries/kmp-iap/openiap-versions.json',
    'libraries/maui-iap/openiap-versions.json',
  ]) {
    expectSymlinkTarget(
      libraryVersionLink,
      '../../openiap-versions.json',
      `${libraryVersionLink} version SSOT link`,
    );
  }
  expectFile('packages/docs/openiap-versions.json');
  if (
    exists('packages/docs/openiap-versions.json') &&
    fs.lstatSync(abs('packages/docs/openiap-versions.json')).isSymbolicLink()
  ) {
    fail('packages/docs/openiap-versions.json must be a real file for Vercel deployment');
  }
  expectSameFile(
    'openiap-versions.json',
    'packages/docs/openiap-versions.json',
    'Docs package version copy',
  );
  expectFile('packages/docs/src/generated/version-metadata.json');
  if (exists('packages/docs/src/generated/version-metadata.json')) {
    const docsVersionMetadata = readJson('packages/docs/src/generated/version-metadata.json');
    const expectedDocsVersionMetadata = {
      _generatedBy: 'scripts/sync-versions.sh',
      expoPackageVersion: readJson('libraries/expo-iap/package.json').version,
      reactNativePackageVersion: readJson('libraries/react-native-iap/package.json').version,
      flutterPackageVersion: read('libraries/flutter_inapp_purchase/pubspec.yaml')
        .match(/^version:\s*(.+)$/m)?.[1]
        ?.trim(),
      godotPackageVersion: read('libraries/godot-iap/addons/godot-iap/plugin.cfg')
        .match(/^version="([^"]+)"$/m)?.[1]
        ?.trim(),
      kmpPackageVersion: read('libraries/kmp-iap/gradle.properties')
        .match(/^libraryVersion=(.+)$/m)?.[1]
        ?.trim(),
      mauiPackageId: read('libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj')
        .match(/<PackageId>([^<]+)<\/PackageId>/)?.[1]
        ?.trim(),
      mauiPackageVersion: read('libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj')
        .match(/<PackageVersion>([^<]+)<\/PackageVersion>/)?.[1]
        ?.trim(),
      googleCompileSdk: read('packages/google/openiap/build.gradle.kts')
        .match(/compileSdk\s*=\s*(\d+)/)?.[1],
      googleMinSdk: read('packages/google/openiap/build.gradle.kts')
        .match(/minSdk\s*=\s*(\d+)/)?.[1],
      googlePlayBillingVersion: read('packages/google/openiap/build.gradle.kts')
        .match(/val\s+playBillingVersion\s*=\s*"([^"]+)"/)?.[1],
      kmpCompileSdk: read('libraries/kmp-iap/gradle/libs.versions.toml')
        .match(/^android-compileSdk = "([^"]+)"/m)?.[1],
      kmpMinSdk: read('libraries/kmp-iap/gradle/libs.versions.toml')
        .match(/^android-minSdk = "([^"]+)"/m)?.[1],
      kmpTargetSdk: read('libraries/kmp-iap/gradle/libs.versions.toml')
        .match(/^android-targetSdk = "([^"]+)"/m)?.[1],
    };
    for (const [key, expectedValue] of Object.entries(expectedDocsVersionMetadata)) {
      if (docsVersionMetadata[key] !== expectedValue) {
        fail(`packages/docs/src/generated/version-metadata.json ${key} must be synced from SSOT metadata`);
      }
    }
  }
  expectIncludes('packages/apple/README.md', [
    '.package(url: "https://github.com/hyodotdev/openiap.git", from: "<version>")',
    "pod 'openiap', '~> <version>'",
    'Use the latest version from the Swift Package / CocoaPods badges above.',
  ], 'Apple README install version');
  expectIncludes('packages/google/README.md', [
    'implementation("io.github.hyochan.openiap:openiap-google:<version>")',
    'https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google',
  ], 'Google README install version');
  expectIncludes('packages/docs/src/lib/versioning.ts', [
    "type VersionKey = 'spec' | 'google' | 'apple';",
    "'spec'",
    "'google'",
    "'apple'",
    "../generated/version-metadata.json",
    'expoPackageVersion',
    'reactNativePackageVersion',
    'godotPackageVersion',
    'EXPO_PACKAGE_VERSION',
    'REACT_NATIVE_PACKAGE_VERSION',
    'GODOT_PACKAGE_VERSION',
    'dependencyLine: `"expo-iap": "^${EXPO_PACKAGE_VERSION}"`',
  ], 'docs versioning keys');
  expectNotIncludes('packages/docs/src/lib/versioning.ts', [
    '../../../../libraries/',
    '../../../../packages/',
  ], 'docs versioning must not import files outside packages/docs because Vercel uploads the docs package root');
  expectIncludes('packages/docs/src/lib/images.ts', [
    'EXPO_PACKAGE.installCommand',
    'REACT_NATIVE_PACKAGE.installCommand',
    'GODOT_PACKAGE.releaseUrl',
  ], 'docs library metadata must derive framework package versions from metadata');
  expectIncludes('packages/docs/src/pages/docs/setup/expo.tsx', [
    'EXPO_PACKAGE.dependencyLine',
  ], 'Expo docs package.json example must derive package version from package metadata');
  expectNotIncludes('packages/docs/src/pages/docs/setup/expo.tsx', [
    '"expo-iap": "latest"',
  ], 'Expo docs package.json example must not use a floating latest version');
  expectIncludes('packages/docs/src/pages/docs/android-setup.tsx', [
    'OPENIAP_VERSIONS.google',
  ], 'Android setup docs install version');
  expectNotIncludes('packages/apple/README.md', [
    '$version',
    `from: "${versions.apple}"`,
    `pod 'openiap', '~> ${versions.apple}'`,
  ], 'Apple README install version must not be inline hardcoded');
  expectNotIncludes('packages/google/README.md', [
    '$version',
    `openiap-google:${versions.google}`,
  ], 'Google README install version must not be inline hardcoded');

  for (const localPathFile of [
    'knowledge/internal/07-docs-consistency.md',
    'libraries/kmp-iap/example/run-ios.sh',
  ]) {
    expectNotIncludes(localPathFile, [
      '/Users/',
      '/home/',
      'C:\\',
    ], 'tracked scripts/docs must not contain local absolute paths');
  }
  expectOptionalNotIncludes('libraries/expo-iap/example/android/settings.gradle', [
    '/Users/',
    '/home/',
    'C:\\',
  ], 'tracked scripts/docs must not contain local absolute paths');
  for (const canonicalUrlFile of [
    'scripts/audit-docs.ts',
    'libraries/expo-iap/CLAUDE.md',
    'libraries/flutter_inapp_purchase/CLAUDE.md',
    'libraries/kmp-iap/CLAUDE.md',
    'libraries/react-native-iap/CLAUDE.md',
    'libraries/react-native-iap/src/index.ts',
    'libraries/react-native-iap/src/hooks/useIAP.ts',
    'libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart',
    'libraries/godot-iap/addons/godot-iap/godot_iap.gd',
    'libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt',
    'libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt',
    'packages/apple/Sources/OpenIapModule.swift',
    'packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt',
  ]) {
    expectNotIncludes(canonicalUrlFile, [
      'https://www.openiap.dev',
    ], `${canonicalUrlFile} must use canonical OpenIAP URLs`);
  }
  expectIncludes('packages/docs/src/lib/images.ts', [
    "documentationUrl: 'https://openiap.dev/docs/setup/expo'",
    "documentationUrl: 'https://openiap.dev/docs/setup/react-native'",
    "documentationUrl: 'https://openiap.dev/docs/setup/flutter'",
    "documentationUrl: 'https://openiap.dev/docs/setup/kmp'",
    "documentationUrl: 'https://openiap.dev/docs/setup/godot'",
  ], 'docs library cards should point at OpenIAP setup docs');
  expectNotIncludes('packages/docs/src/lib/images.ts', [
    "documentationUrl: 'https://hyochan.github.io/expo-iap'",
    "documentationUrl: 'https://hyochan.github.io/react-native-iap'",
    "documentationUrl: 'https://hyochan.github.io/flutter_inapp_purchase'",
    "documentationUrl: 'https://hyochan.github.io/kmp-iap'",
    "documentationUrl: 'https://hyochan.github.io/godot-iap'",
  ], 'docs library cards must not point at legacy standalone docs');
  expectIncludes('libraries/expo-iap/README.md', [
    'https://openiap.dev/frameworks/expo.svg',
    'https://openiap.dev/docs/setup/expo',
    'https://openiap.dev/docs/guides/ai-assistants',
    'https://openiap.dev/llms.txt',
    'https://openiap.dev/docs/features/alternative-marketplace/onside',
    'https://github.com/hyodotdev/openiap/discussions/categories/expo-iap',
    'https://openiap.dev/sponsors/nami.webp',
    'https://openiap.dev/sponsors/courier.webp',
  ], 'Expo README docs links');
  expectIncludes('libraries/expo-iap/CONTRIBUTING.md', [
    'https://openiap.dev/docs/setup/expo',
    'https://openiap.dev/docs/apis',
  ], 'Expo contributing docs links');
  expectIncludes('libraries/expo-iap/src/index.ts', [
    'https://openiap.dev/docs/apis/request-purchase',
  ], 'Expo runtime docs links');
  expectIncludes('libraries/expo-iap/src/useIAP.ts', [
    'https://openiap.dev/docs/setup/expo#useIAP-hook',
    'https://openiap.dev/docs/apis/request-purchase',
  ], 'Expo useIAP docs links');
  expectNotIncludes('libraries/expo-iap/README.md', [
    '](https://hyochan.github.io/expo-iap',
    'https://hyochan.github.io/expo-iap/guides',
    'https://hyochan.github.io/expo-iap/llms',
    'https://hyochan.github.io/expo-iap/getting-started',
    'https://github.com/hyochan/expo-iap/discussions/143',
    'https://github.com/hyochan/react-native-iap/discussions/2754',
    'https://github.com/hyochan/react-native-iap/assets',
    'https://github.com/user-attachments/assets/319d8966-6839-498d-8ead-ce8cc72c3bca',
    'https://www.openiap.dev',
  ], 'Expo README must not point at legacy standalone docs');
  for (const expoDocsFile of [
    'libraries/expo-iap/CONTRIBUTING.md',
    'libraries/expo-iap/src/index.ts',
    'libraries/expo-iap/src/useIAP.ts',
    'libraries/expo-iap/src/modules/android.ts',
    'libraries/expo-iap/src/modules/ios.ts',
  ]) {
    expectNotIncludes(expoDocsFile, [
      'hyochan.github.io/expo-iap',
      'https://www.openiap.dev',
    ], `${expoDocsFile} must not point at legacy standalone docs`);
  }
  expectIncludes('libraries/react-native-iap/README.md', [
    'https://openiap.dev/frameworks/react-native.webp',
    'https://openiap.dev/docs/setup/react-native',
    'https://openiap.dev/docs/guides/ai-assistants',
    'https://openiap.dev/llms.txt',
    'https://openiap.dev/docs/apis',
    'https://openiap.dev/docs/errors',
    'https://openiap.dev/sponsors/nami.webp',
    'https://openiap.dev/sponsors/courier.webp',
  ], 'React Native README docs links');
  expectIncludes('libraries/react-native-iap/CONTRIBUTING.md', [
    'https://openiap.dev/docs/setup/react-native',
  ], 'React Native contributing docs links');
  expectNotIncludes('libraries/react-native-iap/README.md', [
    '](https://hyochan.github.io/react-native-iap',
    'https://hyochan.github.io/react-native-iap/docs',
    'https://hyochan.github.io/react-native-iap/llms',
    'https://github.com/hyochan/react-native-iap/assets',
    'https://github.com/user-attachments/assets/319d8966-6839-498d-8ead-ce8cc72c3bca',
    'https://www.openiap.dev',
  ], 'React Native README must not point at legacy standalone docs');
  expectNotIncludes('libraries/react-native-iap/CONTRIBUTING.md', [
    'hyochan.github.io/react-native-iap',
    'Recent highlights (',
    'OpenIAP to `~>',
  ], 'React Native contributing must not point at legacy standalone docs');
  expectIncludes('libraries/react-native-iap/scripts/ci-check.sh', [
    'run_check()',
    'run_check "📦 Installing dependencies..."',
    'run_check "🧪 Running tests..."',
  ], 'React Native local CI script should use shared check helper');
  expectNotIncludes('libraries/react-native-iap/scripts/ci-check.sh', [
    'if [ $? -ne 0 ]; then',
  ], 'React Native local CI script should not repeat exit-code checks');
  expectIncludes('libraries/flutter_inapp_purchase/README.md', [
    'https://openiap.dev/frameworks/flutter.svg',
    'https://openiap.dev/docs/setup/flutter',
    'https://openiap.dev/docs/guides/ai-assistants',
    'https://openiap.dev/llms.txt',
  ], 'Flutter README docs links');
  expectIncludes('libraries/flutter_inapp_purchase/CONTRIBUTING.md', [
    'https://github.com/hyodotdev/openiap/discussions',
  ], 'Flutter contributing discussion links');
  expectNotIncludes('libraries/flutter_inapp_purchase/README.md', [
    '](https://hyochan.github.io/flutter_inapp_purchase',
    'https://hyochan.github.io/flutter_inapp_purchase/docs',
    'https://hyochan.github.io/flutter_inapp_purchase/llms',
  ], 'Flutter README must not point at legacy standalone docs');
  expectNotIncludes('libraries/flutter_inapp_purchase/CONTRIBUTING.md', [
    'github.com/hyochan/openiap.dev',
  ], 'Flutter contributing links must point at the monorepo');
  expectIncludes('libraries/godot-iap/README.md', [
    'https://openiap.dev/docs/setup/godot',
    'https://openiap.dev/docs/guides/ai-assistants',
    'https://openiap.dev/llms.txt',
    'https://openiap.dev/docs/apis',
    'https://openiap.dev/docs/example',
    '[LICENSE](../../LICENSE)',
  ], 'Godot README docs links');
  expectIncludes('libraries/godot-iap/CONTRIBUTING.md', [
    'https://github.com/hyodotdev/openiap/issues',
    'https://openiap.dev/docs/setup/godot',
  ], 'Godot contributing docs links');
  expectIncludes('libraries/godot-iap/EXAMPLES.md', [
    'https://openiap.dev/docs/setup/godot',
    'https://openiap.dev/docs/apis',
  ], 'Godot examples docs links');
  for (const godotDocsFile of [
    'libraries/godot-iap/README.md',
    'libraries/godot-iap/CONTRIBUTING.md',
    'libraries/godot-iap/EXAMPLES.md',
  ]) {
    expectNotIncludes(godotDocsFile, [
      'hyochan.github.io/godot-iap',
      'github.com/hyochan/godot-iap',
      '[LICENSE](LICENSE)',
    ], `${godotDocsFile} must not point at legacy standalone docs`);
  }

  const kmpVersion = read('libraries/kmp-iap/gradle.properties')
    .match(/^libraryVersion=(.+)$/m)?.[1]
    ?.trim();
  const kmpLibraryVersions = read('libraries/kmp-iap/gradle/libs.versions.toml');
  const kmpKotlinVersion = kmpLibraryVersions.match(/^kotlin = "([^"]+)"/m)?.[1];
  const kmpGradleVersion = read('libraries/kmp-iap/gradle/wrapper/gradle-wrapper.properties')
    .match(/gradle-([^-]+)-bin\.zip/)?.[1];
  const flutterVersion = read('libraries/flutter_inapp_purchase/pubspec.yaml')
    .match(/^version:\s*(.+)$/m)?.[1]
    ?.trim();
  const mauiVersion = read('libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj')
    .match(/<PackageVersion>([^<]+)<\/PackageVersion>/)?.[1]
    ?.trim();
  if (!kmpVersion) fail('libraries/kmp-iap/gradle.properties is missing libraryVersion');
  if (!flutterVersion) fail('libraries/flutter_inapp_purchase/pubspec.yaml is missing version');
  if (!mauiVersion) fail('OpenIap.Maui.csproj is missing PackageVersion');
  if (flutterVersion) {
    expectIncludes('packages/docs/src/lib/versioning.ts', [
      'flutterPackageVersion',
      'FLUTTER_PACKAGE',
      'dependencyLine: `flutter_inapp_purchase: ^${FLUTTER_PACKAGE_VERSION}`',
    ], 'docs Flutter package metadata must derive from generated docs metadata');
    expectIncludes('packages/docs/src/lib/images.ts', [
      'FLUTTER_PACKAGE.installCommand',
    ], 'docs Flutter library listing install command');
    expectIncludes('packages/docs/src/pages/docs/setup/flutter.tsx', [
      'ANDROID_SDK',
      'FLUTTER_PACKAGE',
      'FLUTTER_PACKAGE.dependencyLine',
    ], 'Flutter setup docs package metadata');
    expectIncludes('libraries/flutter_inapp_purchase/README.md', [
      'flutter pub add flutter_inapp_purchase',
      'https://pub.dev/packages/flutter_inapp_purchase',
    ], 'Flutter README should reference pub.dev without an inline version');
    for (const flutterDoc of [
      'libraries/flutter_inapp_purchase/README.md',
      'packages/docs/src/pages/docs/setup/flutter.tsx',
    ]) {
      expectNotIncludes(flutterDoc, [
        `flutter_inapp_purchase: ^${flutterVersion}`,
      ], 'Flutter install command version must not be inline hardcoded');
    }
    for (const flutterPodspec of [
      'libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase.podspec',
      'libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase.podspec',
    ]) {
      expectIncludes(flutterPodspec, [
        'pubspec_path',
        'pubspec_version',
        's.version          = pubspec_version',
      ], 'Flutter podspec version must derive from pubspec.yaml');
      expectNotIncludes(flutterPodspec, [
        "s.version          = '0.0.1'",
      ], 'Flutter podspec version must not drift from pubspec.yaml');
    }
    expectNotIncludes('libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase.podspec', [
      'http://example.com',
      'Your Company',
      'email@example.com',
    ], 'Flutter iOS podspec metadata must not use placeholders');
  }
  if (kmpVersion) {
    expectIncludes('packages/docs/src/lib/versioning.ts', [
      'kmpPackageVersion',
      'KMP_PACKAGE',
      'installCommand: `implementation("io.github.hyochan:kmp-iap:${KMP_PACKAGE_VERSION}")`',
    ], 'docs KMP package metadata must derive from generated docs metadata');
    expectIncludes('packages/docs/src/lib/images.ts', [
      'KMP_PACKAGE.installCommand',
    ], 'docs KMP install command');
    expectIncludes('packages/docs/src/pages/docs/setup/kmp.tsx', [
      "LIBRARIES.find(({ name }) => name === 'kmp-iap')",
      'KMP_ANDROID_SDK',
      'KMP_INSTALL_COMMAND',
      'KMP_VERSION',
    ], 'KMP setup docs install command');
    expectNotIncludes('packages/docs/src/pages/docs/setup/kmp.tsx', [
      '<latest-version>',
    ], 'KMP setup docs install command must be copyable');
    expectIncludes('libraries/kmp-iap/README.md', [
      'implementation("io.github.hyochan:kmp-iap:<version>")',
      'https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap',
      'https://openiap.dev/docs/setup/kmp',
      'https://openiap.dev/llms.txt',
      'license-Apache--2.0',
      'Apache License 2.0',
    ], 'KMP README should reference Maven Central without an inline version');
    expectNotIncludes('libraries/kmp-iap/README.md', [
      `implementation("io.github.hyochan:kmp-iap:${kmpVersion}")`,
      'hyochan.github.io/kmp-iap',
      'license-MIT',
      'MIT License',
    ], 'KMP README install command version must not be inline hardcoded');
    expectIncludes('libraries/kmp-iap/library/library.podspec', [
      'gradle_properties_file',
      'libraryVersion=',
      'spec.version                  = library_version',
      'spec.source                   = { :git => \'https://github.com/hyodotdev/openiap.git\', :tag => "kmp-iap-#{library_version}" }',
      "spec.authors                  = { 'Hyo Dev' => 'hyo@hyo.dev' }",
      "spec.license                  = { :type => 'Apache-2.0', :file => '../LICENSE' }",
    ], 'KMP podspec version');
    expectNotIncludes('libraries/kmp-iap/library/library.podspec', [
      `spec.version                  = '${kmpVersion}'`,
      "spec.source                   = { :http=> ''}",
      "spec.authors                  = ''",
      "spec.license                  = ''",
    ], 'KMP podspec version must derive from gradle.properties');
    expectIncludes('libraries/kmp-iap/library/build.gradle.kts', [
      'fun dynamicKmpPodspec(): String',
      'tasks.matching { it.name == "podspec" }.configureEach',
      'projectDir.resolve("library.podspec").writeText(dynamicKmpPodspec())',
      'spec.version                  = library_version',
      'openiap_apple_version = openiap_versions[\'apple\']',
    ], 'KMP podspec Gradle generator must preserve dynamic metadata');
  }
  const kmpExampleVersions = read('libraries/kmp-iap/example/gradle/libs.versions.toml');
  const kmpExampleKotlinVersion = kmpExampleVersions.match(/^kotlin = "([^"]+)"/m)?.[1];
  const kmpCompileSdk = kmpExampleVersions.match(/^android-compileSdk = "([^"]+)"/m)?.[1];
  const kmpMinSdk = kmpExampleVersions.match(/^android-minSdk = "([^"]+)"/m)?.[1];
  const kmpTargetSdk = kmpExampleVersions.match(/^android-targetSdk = "([^"]+)"/m)?.[1];
  if (!kmpKotlinVersion || !kmpGradleVersion) {
    fail('KMP library must declare Kotlin and Gradle wrapper versions');
  } else if (kmpExampleKotlinVersion !== kmpKotlinVersion) {
    fail(`KMP example Kotlin ${kmpExampleKotlinVersion} must match library Kotlin ${kmpKotlinVersion}`);
  } else {
    expectIncludes('packages/docs/src/pages/docs/setup/kmp.tsx', [
      `Kotlin ${kmpKotlinVersion}+`,
      `Gradle ${kmpGradleVersion}+`,
      'JDK 17+',
    ], 'KMP setup docs toolchain versions');
    expectIncludes('libraries/kmp-iap/example/composeApp/build.gradle.kts', [
      'implementation(libs.kotlinx.coroutines.swing)',
    ], 'KMP example desktop coroutines must use version catalog');
    expectIncludes('libraries/kmp-iap/example/gradle/libs.versions.toml', [
      'kotlinx-coroutines-swing',
    ], 'KMP example coroutines aliases must match root catalog naming');
    expectNotIncludes('libraries/kmp-iap/example/gradle/libs.versions.toml', [
      'kotlinx-coroutinesSwing',
    ], 'KMP example coroutines aliases must not use root-incompatible camel suffixes');
    expectNotIncludes('libraries/kmp-iap/example/composeApp/build.gradle.kts', [
      'org.jetbrains.kotlinx:kotlinx-coroutines-swing:',
    ], 'KMP example desktop coroutines must not hardcode Maven versions');
    expectIncludes('libraries/kmp-iap/CONTRIBUTING.md', [
      'JDK 17 or higher',
      'https://github.com/hyodotdev/openiap/issues',
      'https://github.com/hyodotdev/openiap/discussions/categories/kmp-iap',
    ], 'KMP contributing JDK requirement');
    expectNotIncludes('libraries/kmp-iap/CONTRIBUTING.md', [
      'github.com/hyochan/kmp-iap',
      'github.com/hyochan/openiap.dev',
    ], 'KMP contributing links must point at the monorepo');
    expectIncludes('libraries/kmp-iap/CHANGELOG.md', [
      'https://github.com/hyodotdev/openiap/releases?q=kmp-iap&expanded=true',
    ], 'KMP changelog release link');
    expectNotIncludes('libraries/kmp-iap/CHANGELOG.md', [
      'github.com/hyochan/kmp-iap',
    ], 'KMP changelog must not point at the legacy standalone repository');
  }
  if (!kmpCompileSdk || !kmpMinSdk || !kmpTargetSdk) {
    fail('KMP example libs.versions.toml must declare Android SDK versions');
  } else {
    expectIncludes('packages/docs/src/lib/versioning.ts', [
      'kmpCompileSdk',
      'kmpMinSdk',
      'kmpTargetSdk',
      'export const KMP_ANDROID_SDK',
    ], 'docs KMP Android SDK metadata must derive from generated docs metadata');
    expectIncludes('packages/docs/src/pages/docs/setup/kmp.tsx', [
      'compileSdk = ${KMP_ANDROID_SDK.compileSdk}',
      'minSdk = ${KMP_ANDROID_SDK.minSdk}',
      'targetSdk = ${KMP_ANDROID_SDK.targetSdk}',
    ], 'KMP setup docs Android SDK versions');
    expectNotIncludes('packages/docs/src/pages/docs/setup/kmp.tsx', [
      `compileSdk = ${kmpCompileSdk}`,
      `minSdk = ${kmpMinSdk}`,
      `targetSdk = ${kmpTargetSdk}`,
    ], 'KMP setup docs Android SDK versions must not be inline hardcoded');
  }
  expectIncludes('libraries/kmp-iap/gradle/libs.versions.toml', [
    'compose-material-icons = "1.7.3"',
    'compose-material-icons-extended',
    'version.ref = "compose-material-icons"',
  ], 'KMP root Compose icon dependency');
  expectIncludes('libraries/kmp-iap/example/gradle/libs.versions.toml', [
    'compose-material-icons = "1.7.3"',
    'compose-material-icons-extended',
    'version.ref = "compose-material-icons"',
  ], 'KMP standalone example Compose icon dependency');
  expectIncludes('libraries/kmp-iap/example/composeApp/build.gradle.kts', [
    'libs.compose.material.icons.extended',
    '-Xexpect-actual-classes',
  ], 'KMP example Compose icon dependency');
  expectIncludes('libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/SubscriptionFlowScreen.kt', [
    'List<ProductSubscription>',
    'FetchProductsResultSubscriptions',
  ], 'KMP example subscription product handling');
  expectNotIncludes('libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/SubscriptionFlowScreen.kt', [
    'is ProductAndroid',
    'is ProductIOS',
  ], 'KMP example subscription product handling must not type-check impossible product variants');
  if (mauiVersion) {
    expectIncludes('packages/docs/src/lib/versioning.ts', [
      'mauiPackageId',
      'mauiPackageVersion',
      'MAUI_PACKAGE',
      'installCommand: `dotnet add package ${MAUI_PACKAGE_ID}`',
      'packageReference: `<PackageReference Include="${MAUI_PACKAGE_ID}" Version="${MAUI_PACKAGE_VERSION}" />`',
    ], 'docs MAUI package metadata must derive from generated docs metadata');
    expectIncludes('packages/docs/src/lib/images.ts', [
      'MAUI_PACKAGE',
      'installCommand: MAUI_PACKAGE.installCommand',
    ], 'docs MAUI library listing install command');
    expectIncludes('packages/docs/src/pages/docs/setup/maui.tsx', [
      "import { MAUI_PACKAGE } from '../../../lib/versioning'",
      'MAUI_PACKAGE.installCommand',
      'MAUI_PACKAGE.packageReference',
      'MAUI_PACKAGE.versionedNugetUrl',
    ], 'MAUI setup docs package metadata');
    expectIncludes('libraries/maui-iap/README.md', [
      'dotnet add package OpenIap.Maui',
      'https://www.nuget.org/packages/OpenIap.Maui',
    ], 'MAUI README should reference the NuGet package without an inline version');
    for (const mauiInstallDoc of [
      'packages/docs/src/lib/images.ts',
      'packages/docs/src/pages/docs/setup/maui.tsx',
      'libraries/maui-iap/README.md',
    ]) {
      expectNotIncludes(mauiInstallDoc, [
        `OpenIap.Maui --version ${mauiVersion}`,
      ], 'MAUI install command version must not be inline hardcoded');
    }
    for (const mauiPackageReferenceDoc of [
      'packages/docs/src/pages/docs/setup/maui.tsx',
      'libraries/maui-iap/README.md',
    ]) {
      expectNotIncludes(mauiPackageReferenceDoc, [
        `<PackageReference Include="OpenIap.Maui" Version="${mauiVersion}" />`,
      ], 'MAUI PackageReference version must not be inline hardcoded');
    }
  }

  expectIncludes('scripts/sync-versions.mjs', [
    'openiap-versions.json',
    './scripts/sync-versions.sh',
  ], 'root version sync script');
  expectNotIncludes('scripts/sync-versions.mjs', [
    'writeFileSync',
    'pkgJson.version',
    'const packages = [',
  ], 'root version sync wrapper must delegate writes to scripts/sync-versions.sh');
  expectIncludes('scripts/sync-versions.sh', [
    'set -euo pipefail',
    'sync_package_json_version "packages/gql/package.json" "spec"',
    'sync_package_json_version "packages/docs/package.json" "spec"',
    'sync_package_json_version "packages/google/package.json" "google"',
    'sync_package_json_version "packages/apple/package.json" "apple"',
  ], 'shell version sync must update package metadata for release workflows');
  if (exists('packages/gql/package-lock.json')) {
    fail('packages/gql must not keep a stale npm package-lock.json; Bun lockfiles are the package-manager SSOT');
  }
  expectIncludes('packages/gql/README.md', [
    'bun install --frozen-lockfile',
  ], 'GQL README must document Bun installs');
  expectNotIncludes('packages/gql/README.md', [
    'npm install',
  ], 'GQL README must not document npm installs');
  expectIncludes('.gitignore', [
    'package-lock.json',
  ], 'root gitignore must prevent npm lockfile drift in Bun-managed packages');
  for (const bunPackageJson of [
    'packages/gql/package.json',
    'packages/docs/package.json',
    'packages/google/package.json',
    'packages/apple/package.json',
  ]) {
    expectIncludes(bunPackageJson, [
      '"packageManager": "bun@1.3.13"',
    ], `${bunPackageJson} package manager must match the monorepo Bun version`);
  }
  for (const bunWorkflow of [
    '.github/workflows/ci.yml',
    '.github/workflows/ci-expo-iap.yml',
    '.github/workflows/release-expo.yml',
    '.github/workflows/release.yml',
  ]) {
    expectIncludes(bunWorkflow, [
      'bun-version: 1.3.13',
    ], `${bunWorkflow} must pin Bun to the monorepo packageManager version`);
    expectNotIncludes(bunWorkflow, [
      'bun-version: "1.1.38"',
      'bun-version: latest',
    ], `${bunWorkflow} must not drift from the monorepo Bun version`);
  }
  for (const bunInstallWorkflow of [
    '.github/workflows/ci.yml',
    '.github/workflows/ci-expo-iap.yml',
    '.github/workflows/release-expo.yml',
    '.github/workflows/release.yml',
  ]) {
    expectIncludes(bunInstallWorkflow, [
      'bun install --frozen-lockfile',
    ], `${bunInstallWorkflow} must enforce lockfile installs`);
    expectNotIncludes(bunInstallWorkflow, [
      'run: bun install\n',
      'bun install && break',
    ], `${bunInstallWorkflow} must not allow lockfile drift during installs`);
  }
  expectIncludes('packages/google/scripts/publish-local.sh', [
    '${openIapGroupId:-io.github.hyochan.openiap}:openiap-google',
  ], 'Google publish-local coordinate hint');
  expectNotIncludes('packages/google/scripts/publish-local.sh', [
    '${openIapGroupId:-io.github.hyochan}:openiap-google',
  ], 'Google publish-local coordinate hint must use published groupId');
  expectIncludes('packages/google/scripts/update-version.sh', [
    'REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"',
    "jq --arg version \"$VERSION\" '.google = $version'",
    'data["google"] = os.environ["VERSION"]',
    '"$REPO_ROOT/scripts/sync-versions.sh"',
    'packages/*/openiap-versions.json',
    'packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json',
  ], 'Google update-version must preserve openiap-versions.json fields');
  expectNotIncludes('packages/google/scripts/update-version.sh', [
    'cat > "$VERSIONS_FILE"',
    '"spec": "$SPEC_VERSION"',
    '"google": "$VERSION"',
    'sed -i',
  ], 'Google update-version must not rewrite openiap-versions.json or use platform sed');
  expectIncludes('packages/apple/scripts/bump-version.sh', [
    'REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"',
    "jq -er '.apple | select(type == \"string\" and length > 0)'",
    'python3 - "${VERSIONS_FILE}"',
    'raise SystemExit(f"missing apple in {path}")',
    "jq --arg version \"$NEW_VERSION\" '.apple = $version'",
    "data['apple'] = os.environ[\"VERSION\"]",
    '"$REPO_ROOT/scripts/sync-versions.sh"',
    'packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json',
    'git commit -m "chore(apple): bump version to $NEW_VERSION"',
    'git pull --rebase origin main',
    'git push origin HEAD:main',
    'git ls-remote --exit-code --tags origin "refs/tags/$NEW_VERSION"',
  ], 'Apple bump-version must preserve openiap-versions.json fields');
  expectNotIncludes('packages/apple/scripts/bump-version.sh', [
    'openiap-apple.git',
    'sed -i',
    'chore: bump version',
    'git tag -d "$NEW_VERSION"',
  ], 'Apple bump-version must use monorepo coordinates and conventional commits');
  expectIncludes('scripts/deploy.sh', [
    'set -euo pipefail',
    'VERCEL_CLI_VERSION="54.0.0"',
    'npm install -g "vercel@$VERCEL_CLI_VERSION"',
    'if [ -z "${1:-}" ]; then',
    'if ! ./scripts/sync-versions.sh; then',
    'if ! bun run typecheck; then',
    'if ! bun run build; then',
    'if ! vercel --prod; then',
    'git commit -m "chore(spec): bump version to $VERSION"',
    'git pull --rebase origin main',
    'git push origin HEAD:main',
    'packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json',
  ], 'deploy script commit message');
  expectNotIncludes('scripts/deploy.sh', [
    'npm install -g vercel',
    'if [ $? -ne 0 ]; then',
  ], 'deploy script must not install a floating Vercel CLI');
  expectIncludes('packages/docs/deploy.sh', [
    'set -euo pipefail',
    'VERCEL_CLI_VERSION="54.0.0"',
    'npm install -g "vercel@$VERCEL_CLI_VERSION"',
    'if ! bun run typecheck; then',
    'if ! bun run build; then',
  ], 'docs deploy script must be deterministic and preserve failure messages');
  expectNotIncludes('packages/docs/deploy.sh', [
    'npm install -g vercel',
    'if [ $? -ne 0 ]; then',
  ], 'docs deploy script must not install floating CLIs or bypass custom failure messages');
  expectIncludes('.github/workflows/release.yml', [
    'git commit -m "chore(docs): bump version to $VERSION"',
    "jq --arg version \"$VERSION\" '.spec = $version'",
    'git show HEAD:openiap-versions.json > /tmp/upstream-openiap-versions.json',
    './scripts/sync-versions.sh',
    'packages/docs/src/generated/version-metadata.json',
    'if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then',
    'Tag $TAG_NAME already exists',
    'packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json',
  ], 'docs release workflow commit message');
  expectNotIncludes('.github/workflows/release.yml', [
    'git pull --rebase origin main || true',
  ], 'docs release workflow must not hide version rebase conflicts');
  for (const releaseWorkflow of [
    '.github/workflows/release-apple.yml',
    '.github/workflows/release-google.yml',
  ]) {
    expectIncludes(releaseWorkflow, [
      'openiap-versions.json|packages/*/openiap-versions.json|packages/gql/package.json|packages/docs/package.json|packages/google/package.json|packages/apple/package.json',
      'git show HEAD:openiap-versions.json > /tmp/upstream-openiap-versions.json',
      'Re-sync package metadata and docs copy after merge',
      './scripts/sync-versions.sh',
      'packages/docs/src/generated/version-metadata.json',
      'packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json',
    ], `${releaseWorkflow} must commit package metadata synced from openiap-versions.json`);
    expectNotIncludes(releaseWorkflow, [
      'cp openiap-versions.json packages/docs/openiap-versions.json',
      'git show HEAD:"$conflict_file"',
      '/tmp/theirs.json',
    ], `${releaseWorkflow} must not only sync the docs copy after conflict resolution`);
  }
  expectIncludes('.github/workflows/release-apple.yml', [
    'COCOAPODS_VERSION: 1.15.2',
    'gem install cocoapods -v "$COCOAPODS_VERSION"',
    'bare_exists=true',
    'bare_exists=false',
    'Checkout release tag (current version)',
    'LEGACY_TAG="apple-v$VERSION"',
    "steps.check_tag.outputs.bare_exists != 'true'",
    'Cleaning up tag created by this run',
  ], 'Apple release workflow must not delete pre-existing tags on validation failure');
  expectNotIncludes('.github/workflows/release-apple.yml', [
    'gem install cocoapods\n',
  ], 'Apple release workflow must pin CocoaPods');
  expectIncludes('.github/workflows/release-google.yml', [
    'release:',
    'runs-on: ubuntu-latest',
    './gradlew :openiap:assembleRelease --no-daemon --stacktrace',
    'artifacts=(openiap/build/outputs/aar/*.aar openiap/build/libs/*.jar)',
    'No Google release artifacts found',
    'cp "${artifacts[@]}" release-artifacts/',
    'Checkout release tag (current version)',
    'LEGACY_TAG="google-v$VERSION"',
    'HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://repo1.maven.org/maven2/io/github/hyochan/openiap/openiap-google/$VERSION/" || true)',
    'HTTP_STATUS="${HTTP_STATUS:-000}"',
    'Unable to verify openiap-google $VERSION on Maven Central',
    'if gh release view "google-$VERSION" >/dev/null 2>&1; then',
    'gh release edit "google-$VERSION"',
    'gh release upload "google-$VERSION" $ARTIFACTS --clobber',
  ], 'Google release workflow must not require a macOS runner');
  for (const [frameworkReleaseWorkflow, tagCommand] of [
    ['.github/workflows/release-expo.yml', 'git tag -a "expo-iap-${NEW_VERSION}"'],
    ['.github/workflows/release-react-native.yml', 'git tag -a "react-native-iap-${NEW_VERSION}"'],
    ['.github/workflows/release-flutter.yml', 'git tag -a "flutter-iap-${NEW_VERSION}"'],
    ['.github/workflows/release-godot.yml', 'git tag -a godot-iap-${{ steps.version.outputs.VERSION }}'],
  ]) {
    expectIncludes(frameworkReleaseWorkflow, [
      'Check if release tag already exists',
      'Checkout release tag (current version)',
      'git checkout "$RELEASE_TAG"',
      'Use \'current\' to retry this version.',
      'Commit version update',
      'STASHED=false',
      'git stash push --include-untracked -m "release artifacts"',
      'git pull --rebase origin main',
      'if [ "$STASHED" = "true" ]; then',
      'git stash pop',
      tagCommand,
      'git push origin HEAD:main --follow-tags',
    ], `${frameworkReleaseWorkflow} must tag after rebasing the release commit`);
    expectNotIncludes(frameworkReleaseWorkflow, [
      'git stash --include-untracked',
      'git stash pop || true',
      'git push --follow-tags',
      'git tag -af',
      'git push origin "flutter-iap-${NEW_VERSION}" --force',
      'create_release:',
      'inputs.create_release',
    ], `${frameworkReleaseWorkflow} must push tags from the rebased HEAD explicitly`);
  }
  for (const [npmReleaseWorkflow, npmPackage] of [
    ['.github/workflows/release-expo.yml', 'expo-iap'],
    ['.github/workflows/release-react-native.yml', 'react-native-iap'],
  ]) {
    expectIncludes(npmReleaseWorkflow, [
      'Check if npm package already published',
      'npm install -g npm@11.5.1',
      `npm view "${npmPackage}@$VERSION" version`,
      `if NPM_OUTPUT=$(npm view "${npmPackage}@$VERSION" version 2>&1); then`,
      "grep -qiE 'E404|404 Not Found'",
      `npm view "${npmPackage}@$NEW_VERSION" gitHead`,
      'git cat-file -e "$PUBLISHED_GIT_HEAD^{commit}"',
      "if: steps.check_npm.outputs.exists == 'false'",
    ], `${npmReleaseWorkflow} must support npm release reruns`);
    expectNotIncludes(npmReleaseWorkflow, [
      'npm install -g npm@latest',
      'node-version: 20.x',
      'set +e',
      'NPM_STATUS=$?',
    ], `${npmReleaseWorkflow} must not drift npm trusted-publishing CLI version`);
  }
  expectIncludes('scripts/verify-npm-consumer-install.mjs', [
    'npm',
    'pack',
    '--pack-destination',
    '--ignore-scripts',
    'openiap-versions.json must be packed as a real file',
    'consumer install smoke test passed',
  ], 'npm consumer install smoke helper');
  for (const [packageJsonPath, packageName] of [
    ['libraries/expo-iap/package.json', 'expo-iap'],
    ['libraries/react-native-iap/package.json', 'react-native-iap'],
  ]) {
    expectIncludes(packageJsonPath, [
      '"verify:consumer-install"',
      'verify-npm-consumer-install.mjs',
      `--package-name ${packageName}`,
      '--required openiap-versions.json',
    ], `${packageJsonPath} must expose npm consumer smoke test`);
  }
  for (const [workflowPath, command] of [
    ['.github/workflows/ci-expo-iap.yml', 'bun run verify:consumer-install'],
    ['.github/workflows/ci-react-native-iap.yml', 'yarn verify:consumer-install'],
    ['.github/workflows/release-expo.yml', 'bun run verify:consumer-install --pack-ignore-scripts'],
    ['.github/workflows/release-react-native.yml', 'verify:consumer-install --pack-ignore-scripts'],
  ]) {
    expectIncludes(workflowPath, [
      'Consumer install smoke test',
      command,
    ], `${workflowPath} must run npm consumer smoke test`);
  }
  expectIncludes('.github/workflows/publish-flutter.yml', [
    'Check if pub.dev package already published',
    'flutter-version: "3.41.9"',
    'HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}"',
    'HTTP_STATUS="${HTTP_STATUS:-000}"',
    'https://pub.dev/api/packages/flutter_inapp_purchase/versions/$VERSION',
    "if: steps.check_pub.outputs.exists == 'false'",
  ], 'Flutter publish workflow must support pub.dev release reruns');
  for (const flutterWorkflow of [
    '.github/workflows/ci-flutter-inapp-purchase.yml',
    '.github/workflows/release-flutter.yml',
    '.github/workflows/publish-flutter.yml',
  ]) {
    expectIncludes(flutterWorkflow, [
      'flutter-version: "3.41.9"',
    ], `${flutterWorkflow} must pin Flutter SDK`);
    expectNotIncludes(flutterWorkflow, [
      'flutter-version: "3.x"',
    ], `${flutterWorkflow} must not float Flutter SDK`);
  }
  for (const releaseNotesWorkflow of [
    '.github/workflows/release-apple.yml',
    '.github/workflows/release-google.yml',
    '.github/workflows/release-kmp.yml',
    '.github/workflows/release-maui.yml',
    '.github/workflows/release-expo.yml',
    '.github/workflows/release-react-native.yml',
    '.github/workflows/release-flutter.yml',
    '.github/workflows/release-godot.yml',
  ]) {
    expectIncludes(releaseNotesWorkflow, [
      'RELEASE_REF="HEAD"',
      '..$RELEASE_REF',
    ], `${releaseNotesWorkflow} release notes must use the release tag when it already exists`);
  }
  for (const xcodeReleaseWorkflow of [
    '.github/workflows/ci.yml',
    '.github/workflows/ci-maui-iap.yml',
    '.github/workflows/release-apple.yml',
    '.github/workflows/release-kmp.yml',
    '.github/workflows/release-maui.yml',
  ]) {
    expectIncludes(xcodeReleaseWorkflow, [
      'runs-on: macos-15',
      'XCODE_VERSION: 16.4',
      'maxim-lobanov/setup-xcode@v1',
      'xcode-version: ${{ env.XCODE_VERSION }}',
    ], `${xcodeReleaseWorkflow} must pin the macOS/Xcode release image`);
    expectNotIncludes(xcodeReleaseWorkflow, [
      'runs-on: macos-latest',
      'sudo xcode-select -s /Applications/Xcode.app',
    ], `${xcodeReleaseWorkflow} must not drift with macos-latest Xcode`);
  }
  expectIncludes('scripts/install-xcodegen.sh', [
    'XCODEGEN_VERSION',
    'XCODEGEN_SHA256',
    'https://github.com/yonaskolb/XcodeGen/releases/download/${VERSION}/xcodegen.zip',
    'shasum -a 256 -c -',
    'install -m 0755',
    'GITHUB_PATH',
  ], 'XcodeGen installer must pin release artifacts');
  for (const xcodegenWorkflow of [
    '.github/workflows/ci-maui-iap.yml',
    '.github/workflows/release-maui.yml',
  ]) {
    expectIncludes(xcodegenWorkflow, [
      'XCODEGEN_VERSION: 2.45.4',
      'XCODEGEN_SHA256: 090ec29491aad50aec10631bf6e62253fed733c50f3aab0f5ffc86bc170bdbef',
      'bash scripts/install-xcodegen.sh "$XCODEGEN_VERSION"',
    ], `${xcodegenWorkflow} must pin XcodeGen`);
    expectNotIncludes(xcodegenWorkflow, [
      'brew install xcodegen',
    ], `${xcodegenWorkflow} must not float XcodeGen via Homebrew`);
  }
  expectIncludes('packages/apple/scripts/build-xcframework.sh', [
    'scripts/install-xcodegen.sh <version>',
  ], 'Apple xcframework script must point to pinned XcodeGen installer');
  expectIncludes('scripts/bump-version.mjs', [
    'const currentVersion = versions[t];',
    '${currentVersion} → ${newVersion}',
    'chore(version): bump <target> to X.X.X',
    "target === 'apple'",
    "`google-${bumpedVersions.google}`",
    "`docs-${bumpedVersions.spec}`",
  ], 'root bump-version output');
  expectIncludes('knowledge/internal/06-git-deployment.md', [
    'Creates Git tag `<apple-version>` (bare semver)',
    'Creates Git tag `google-<google-version>`',
    'Create Git tag `docs-<spec>`',
  ], 'release deployment docs tag conventions');
  expectNotIncludes('scripts/deploy.sh', [
    'git commit -m "chore: bump spec',
  ], 'deploy script commit message must be conventional');
  expectNotIncludes('.github/workflows/release.yml', [
    'git commit -m "chore: bump docs',
  ], 'docs release workflow commit message must be conventional');
  expectNotIncludes('scripts/bump-version.mjs', [
    'chore: bump version',
    '${versions[t]} → ${newVersion}',
    'git tag vX.X.X',
  ], 'root bump-version output must be accurate and conventional');
  expectNotIncludes('knowledge/internal/06-git-deployment.md', [
    'Creates Git tag `apple-v<apple-version>`',
    'Creates Git tag `google-v<google-version>`',
    'Create Git tag `v<spec>`',
  ], 'release deployment docs must not mention legacy tag creation');
  for (const monorepoContribDoc of [
    'packages/apple/CONTRIBUTING.md',
    'packages/google/CONTRIBUTING.md',
    'libraries/kmp-iap/CONTRIBUTING.md',
  ]) {
    expectNotIncludes(monorepoContribDoc, [
      'openiap-apple.git',
      'openiap-google.git',
      'github.com/hyodotdev/openiap-apple',
      'github.com/hyodotdev/openiap-google',
      "git commit -m 'Add amazing feature'",
    ], 'contributing docs must describe the monorepo workflow');
  }
  expectNotIncludes('scripts/sync-versions.mjs', [
    "resolve(rootDir, 'versions.json')",
    'Read versions.json',
  ], 'root version sync script must use openiap-versions.json');
  expectIncludes('scripts/bump-version.mjs', [
    'openiap-versions.json',
  ], 'root version bump script');
  expectNotIncludes('scripts/bump-version.mjs', [
    "resolve(rootDir, 'versions.json')",
    'Updated versions.json',
    'packages/ios/Sources/OpenIapVersion.swift',
    'public static let current',
  ], 'root version bump script must not use obsolete version paths');
  expectNotIncludes('knowledge/internal/04-platform-packages.md', [
    'change `"gql"` version',
    'update the `gql` field',
  ], 'platform package docs must use openiap-versions.json spec key');

  for (const dependencyFile of [
    '.github/workflows/release-godot.yml',
    'libraries/flutter_inapp_purchase/android/build.gradle',
    'libraries/godot-iap/addons/godot-iap/godot_iap_plugin.gd',
    'libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap',
    'libraries/godot-iap/Makefile',
    'libraries/godot-iap/scripts/write-gdap.sh',
  ]) {
    expectNotIncludes(dependencyFile, [
      'com.android.billingclient:billing',
    ], 'Framework libraries must inherit Play Billing from openiap-google');
  }

  expectIncludes('libraries/godot-iap/addons/godot-iap/godot_iap_plugin.gd', [
    'ANDROID_GDAP_PATH',
    '_read_android_remote_dependencies',
    'FileAccess.get_file_as_string(ANDROID_GDAP_PATH)',
  ], 'Godot export plugin dependency source');
  expectNotIncludes('libraries/godot-iap/addons/godot-iap/godot_iap_plugin.gd', [
    'openiap-google:',
    'kotlinx-coroutines-android:',
  ], 'Godot export plugin must read dependency versions from GDAP');
  expectIncludes('libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift', [
    'ErrorCode.userCancelled.rawValue',
    'ErrorCode.developerError.rawValue',
    'ErrorCode.purchaseError.rawValue',
    'ErrorCode.syncError.rawValue',
    '@available(*, deprecated, message: "Use promotedProductIOS signal with requestPurchase instead.")',
    '@available(*, deprecated, message: "Use verifyPurchase instead.")',
  ], 'Godot iOS purchase errors must emit OpenIAP error codes');
  expectNotIncludes('libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift', [
    '"USER_CANCELLED"',
    '"MISSING_SKU"',
    '"PURCHASE_FAILED"',
    '"RESTORE_FAILED"',
  ], 'Godot iOS purchase errors must not emit legacy custom codes');

  if (googleVersion) {
    expectIncludes('libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap', [
      `io.github.hyochan.openiap:openiap-google:${googleVersion}`,
    ], 'Godot Android GDAP OpenIAP dependency version');
  }
  if (googleCoroutinesVersion) {
    expectIncludes('libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap', [
      `org.jetbrains.kotlinx:kotlinx-coroutines-android:${googleCoroutinesVersion}`,
    ], 'Godot Android GDAP coroutines dependency version');
    expectIncludes('libraries/godot-iap/scripts/write-gdap.sh', [
      'set -euo pipefail',
      'GOOGLE_OPENIAP_BUILD=',
      'read_openiap_version()',
      'python3 - "$VERSIONS_FILE" "$1"',
      'OPENIAP_GOOGLE_VERSION="$(read_openiap_version google)"',
      'COROUTINES_VERSION=',
      'read_google_variable coroutinesVersion',
      'fallback_property kotlinxCoroutinesVersion',
      'remote=["io.github.hyochan.openiap:openiap-google:$OPENIAP_GOOGLE_VERSION", "org.jetbrains.kotlinx:kotlinx-coroutines-android:$COROUTINES_VERSION"]',
    ], 'Godot GDAP dependency writer');
    expectIncludes('libraries/godot-iap/scripts/sync-versions.sh', [
      'set -euo pipefail',
      'GOOGLE_OPENIAP_BUILD=',
      'read_openiap_version()',
      'python3 - "$VERSIONS_FILE" "$1"',
      'read_google_variable coroutinesVersion',
      'fallback_property kotlinxCoroutinesVersion',
    ], 'Godot version sync must read coroutines from packages/google when available');
    expectIncludes('libraries/godot-iap/scripts/build_android.sh', [
      'set -euo pipefail',
    ], 'Godot Android build script must fail on unset vars and pipeline failures');
    expectIncludes('libraries/godot-iap/Makefile', [
      'scripts/write-gdap.sh',
    ], 'Godot Makefile must use shared GDAP writer');
    expectIncludes('libraries/godot-iap/Makefile', [
      'gh release list --repo hyodotdev/openiap',
      'startswith("godot-iap-")',
      'RELEASE_VERSION = $(patsubst godot-iap-%,%,$(RELEASE_TAG))',
      'https://github.com/hyodotdev/openiap/releases/download/$(RELEASE_TAG)/$(RELEASE_ZIP_NAME)',
    ], 'Godot Makefile release test target must use monorepo release assets');
    expectNotIncludes('libraries/godot-iap/Makefile', [
      'hyochan/godot-iap',
      'github.com/hyochan/godot-iap/releases',
      'RELEASE_ZIP_NAME = godot-iap-$(RELEASE_TAG).zip',
    ], 'Godot Makefile release test target must not use standalone release assets');
    expectIncludes('.github/workflows/release-godot.yml', [
      './scripts/write-gdap.sh dist/addons/godot-iap/android/GodotIap.gdap',
      'https://openiap.dev/docs/setup/godot',
      'https://openiap.dev/docs/apis',
      'https://openiap.dev/docs/updates/releases',
    ], 'Godot release workflow must use shared GDAP writer');
    expectNotIncludes('.github/workflows/release-godot.yml', [
      'https://www.openiap.dev',
    ], 'Godot release workflow docs links must use canonical OpenIAP URLs');
  }
  expectIncludes('libraries/kmp-iap/native/InAppPurchaseBridge/Package.swift', [
    'resolveOpenIapAppleVersion()',
    'resolveOpenIapApplePackageVersion',
    'openiap-versions.json',
    'openIapApplePackageVersion',
  ], 'KMP native bridge OpenIAP Apple dependency version');
  expectNotIncludes('libraries/kmp-iap/native/InAppPurchaseBridge/Package.swift', [
    'from: "1.2.5"',
    'return "2.1.9"',
    'Version(2, 1, 9)',
  ], 'KMP native bridge OpenIAP Apple dependency version');
  expectIncludes(
    'libraries/kmp-iap/native/InAppPurchaseBridge/Sources/InAppPurchaseBridge/InAppPurchaseBridge.swift',
    ['@_exported import OpenIAP'],
    'KMP native bridge SwiftPM target source',
  );
  expectIncludes('libraries/kmp-iap/library/build.gradle.kts', [
    'val kmpRootDir = projectDir.parentFile',
    'kmpRootDir.resolve("gradle.properties")',
    'kmpRootDir.resolve("openiap-versions.json")',
    'missing openiap-versions.json',
    "'$key' version missing in openiap-versions.json",
    'openIapVersion("apple")',
    'openIapVersion("google")',
    'project.findProperty("libraryVersion")',
    'GenerateKmpIapVersionTask',
    'generateKmpIapVersion',
  ], 'KMP Gradle native dependency versions');
  expectNotIncludes('libraries/kmp-iap/library/build.gradle.kts', [
    '?: "1.2.5"',
    '?: "1.2.10"',
    '1.0.0-alpha02',
    '1.0.0-alpha04',
    'openiap-versions.json with kmp-iap version',
    'tasks.withType<PublishToMavenRepository>',
    'DEBUG:',
    'First 50 chars',
  ], 'KMP Gradle native dependency versions must not silently fallback');
  expectIncludes('libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt', [
    'override fun getVersion(): String = kmpIapVersionString("Android")',
  ], 'KMP Android runtime version');
  expectIncludes('libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt', [
    'override fun getVersion(): String = kmpIapVersionString("iOS")',
  ], 'KMP iOS runtime version');
  expectNotIncludes('libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/Helper.kt', [
    'ANDROID_VERSION',
    '1.0.0-alpha02',
  ], 'KMP Android runtime version must not be stale');
  expectNotIncludes('libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt', [
    '1.0.0-rc.2',
  ], 'KMP iOS runtime version must not be stale');
  expectNotIncludes('libraries/kmp-iap/README.md', [
    '1.0.0-rc.2',
    '1.0.0-alpha02',
  ], 'KMP README version examples must not be stale');
  expectIncludes('.github/workflows/release-kmp.yml', [
    'Update release metadata',
    'Check if release tag already exists',
    'Checkout release tag (current version)',
    'git checkout "$RELEASE_TAG"',
    'libraryVersion=$ENV{VERSION}',
    './scripts/update-readme-version.sh "$VERSION"',
    'git pull --rebase origin main',
    'git push origin HEAD:main',
    'https://repo1.maven.org/maven2/io/github/hyochan/kmp-iap/$VERSION/',
    'Unable to verify kmp-iap $VERSION on Maven Central',
    "if: steps.check_maven.outputs.exists == 'false'",
    'Create and push tag',
    'git tag -a "$RELEASE_TAG" -m "Release $RELEASE_TAG"',
    'git push origin "$RELEASE_TAG"',
    './gradlew :library:assembleRelease --no-daemon --stacktrace',
    'files: libraries/kmp-iap/release-artifacts.zip',
    'implementation("io.github.hyochan:kmp-iap:$VERSION")',
    'implementation \'io.github.hyochan:kmp-iap:$VERSION\'',
    'central.sonatype.com/artifact/io.github.hyochan/kmp-iap/$VERSION',
  ], 'KMP release workflow metadata sync');
  expectNotIncludes('.github/workflows/release-kmp.yml', [
    'create_release:',
    'inputs.create_release',
  ], 'KMP release workflow must always create GitHub releases');
  expectIncludes('packages/docs/src/pages/docs/setup/kmp.tsx', [
    'https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap',
  ], 'docs KMP Maven Central link');
  expectIncludes('packages/docs/src/lib/images.ts', [
    "documentationUrl: 'https://openiap.dev/docs/setup/kmp'",
  ], 'KMP docs card should point at OpenIAP docs');
  expectNotIncludes('packages/docs/src/lib/images.ts', [
    "documentationUrl: 'https://hyochan.github.io/kmp-iap'",
  ], 'KMP docs card must not point at the legacy standalone docs');
  expectIncludes('scripts/agent/compile-context.ts', [
    'function readInstallationVersions()',
    'libraries/kmp-iap/gradle.properties',
    'libraries/godot-iap/addons/godot-iap/plugin.cfg',
    'libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj',
    '<PackageId>([^<]+)<\\/PackageId>',
    'flutter pub add flutter_inapp_purchase',
    'io.github.hyochan:kmp-iap:${versions.kmp}',
    'godot-iap-${versions.godot}.zip',
    'dotnet add package ${versions.mauiPackageId}',
    'Current NuGet package version: ${versions.maui}',
    'https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap',
  ], 'AI context compiler framework package versions');
  expectNotIncludes('scripts/agent/compile-context.ts', [
    'flutter_inapp_purchase: ^${versions.flutter}',
    'io.github.hyochan:kmp-iap:<version>',
    'OpenIap.Maui" Version="${versions.maui}"',
    'dotnet add package OpenIap.Maui',
  ], 'AI context compiler install commands must not hardcode framework package versions');
  expectNotIncludes('.github/workflows/release-kmp.yml', [
    'updatePodspecDependency',
    'updateReadmeVersion',
    'spec\\.version\\s+=',
    'library/library.podspec gradle.properties',
    'io.github.hyochan.openiap:kmp-iap',
    'central.sonatype.com/artifact/io.github.hyochan.openiap/kmp-iap',
    'git pull --rebase origin main || true',
    'git push || echo "No changes to commit"',
    'git stash --include-untracked || true',
    'cp library/build/outputs/aar/*.aar release-artifacts/ || true',
    'cp library/build/libs/*.jar release-artifacts/ || true',
  ], 'KMP release workflow must not call removed tasks or publish wrong coordinates');
  expectIncludes('.github/workflows/release-kmp.yml', [
    'artifacts=(library/build/outputs/aar/*.aar library/build/libs/*.jar)',
    'No KMP release artifacts found',
    'cp "${artifacts[@]}" release-artifacts/',
  ], 'KMP release workflow must fail when release artifacts are missing');
  expectIncludes('.github/workflows/release-maui.yml', [
    '- name: Create and push tag',
    'if: success()',
    'git tag -a "maui-iap-$VERSION" -m "Release maui-iap $VERSION"',
  ], 'MAUI release workflow must create tags before GitHub Release creation');
  expectNotIncludes('.github/workflows/release-maui.yml', [
    'create_release:',
    'inputs.create_release',
  ], 'MAUI release workflow must always create GitHub releases');
  expectNotIncludes('packages/docs/src/pages/docs/setup/kmp.tsx', [
    'io.github.hyochan.kmpiap/library',
  ], 'docs KMP Maven Central link must not use old coordinates');
  expectNotIncludes('scripts/agent/compile-context.ts', [
    'flutter_inapp_purchase: ^5.0.0',
    'io.github.hyochan.kmpiap:library',
    'implementation("io.github.hyochan:kmp-iap:<version>")',
    'OpenIap.Maui" Version="1.0.1',
  ], 'AI context compiler framework package versions must not hardcode stale coordinates');
  const kmpReadmeInjectedVersionSnippet =
    'implementation("io.github.hyochan:kmp-iap:' + '$ENV{VERSION}")';
  expectIncludes('libraries/kmp-iap/scripts/update-readme-version.sh', [
    'implementation("io.github.hyochan:kmp-iap:<version>")',
    'https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap',
  ], 'KMP README version script');
  expectNotIncludes('libraries/kmp-iap/scripts/update-readme-version.sh', [
    'perl -0pi',
    kmpReadmeInjectedVersionSnippet,
    'sed -i',
    'based on local.properties',
  ], 'KMP README version script must not inject release-specific versions');
  for (const generatedTypeScript of [
    'libraries/kmp-iap/scripts/generate-types.sh',
    'libraries/godot-iap/scripts/generate-types.sh',
  ]) {
    expectIncludes(generatedTypeScript, [
      'json.loads',
      'data.get("spec")',
      "Error: 'spec' version missing in openiap-versions.json",
    ], `${generatedTypeScript} must parse openiap-versions.json as JSON`);
    expectNotIncludes(generatedTypeScript, [
      'grep \'"spec"\'',
      "sed 's/.*: *",
    ], `${generatedTypeScript} must not parse JSON with grep/sed`);
  }
  expectIncludes('libraries/godot-iap/scripts/generate-types.sh', [
    'ADDON_DIR="$REPO_ROOT/addons/godot-iap"',
    'EXAMPLE_ADDON_DIR="$REPO_ROOT/Example/addons/godot-iap"',
    'cp "$TEMP_DIR/types.gd" "$ADDON_DIR/types.gd"',
    'cp "$TEMP_DIR/types.gd" "$EXAMPLE_ADDON_DIR/types.gd"',
  ], 'Godot generated types script must update the shipped addon and example');
  expectIncludes('libraries/kmp-iap/publish-local.sh', [
    "grep '^libraryVersion=' gradle.properties",
  ], 'KMP publish-local version lookup');
  expectNotIncludes('libraries/kmp-iap/publish-local.sh', [
    "grep 'version = ' library/build.gradle.kts",
  ], 'KMP publish-local version lookup must not read removed literal version');
  expectIncludes('libraries/kmp-iap/library/library.podspec', [
    'missing openiap-versions.json',
    "'apple' version missing in openiap-versions.json",
  ], 'KMP podspec OpenIAP Apple dependency version');
  expectNotIncludes('libraries/kmp-iap/library/library.podspec', [
    "openiap_apple_version = '1.2.5'",
    'fallback version',
  ], 'KMP podspec OpenIAP Apple dependency version');
  expectIncludes('libraries/kmp-iap/example/iosApp/iosApp.xcodeproj/project.pbxproj', [
    'OPENIAP_APPLE_VERSION=',
    '<string>$OPENIAP_APPLE_VERSION</string>',
  ], 'KMP iOS example OpenIAP framework plist version');
  expectNotIncludes('libraries/kmp-iap/example/iosApp/iosApp.xcodeproj/project.pbxproj', [
    '<string>1.2.5</string>',
  ], 'KMP iOS example OpenIAP framework plist version');
  expectIncludes('libraries/maui-iap/android/openiap/build.gradle.kts', [
    'missing openiap-versions.json',
    "'google' version missing in openiap-versions.json",
  ], 'MAUI Android OpenIAP Google dependency version');
  expectNotIncludes('libraries/maui-iap/android/openiap/build.gradle.kts', [
    '?: "',
    "?: '",
  ], 'MAUI Android OpenIAP Google dependency version must not silently fallback');
  expectIncludes('packages/google/build.gradle.kts', [
    'missing openiap-versions.json',
    "'google' version missing in openiap-versions.json",
    'id("com.android.library") version "8.13.2"',
    'id("com.android.application") version "8.13.2"',
    'id("com.vanniktech.maven.publish") version "0.35.0"',
  ], 'packages/google root OpenIAP version');
  expectIncludes('packages/google/gradle/wrapper/gradle-wrapper.properties', [
    'gradle-8.13-all.zip',
  ], 'packages/google Gradle wrapper must support Vanniktech 0.35.0');
  expectNotIncludes('packages/google/build.gradle.kts', [
    'GQL_VERSION',
    '"gql"',
    'Fallback',
    'id("com.vanniktech.maven.publish") version "0.29.0"',
    'id("com.vanniktech.maven.publish") version "0.34.0"',
    'id("com.vanniktech.maven.publish") version "0.36.0"',
  ], 'packages/google root OpenIAP version');
  expectIncludes('packages/google/openiap/build.gradle.kts', [
    'missing openiap-versions.json',
    "'google' version missing in openiap-versions.json",
    'compilerOptions',
    'JvmTarget.JVM_17',
    'val horizonPlatformVersion =',
    'val horizonBillingCompatibilityVersion =',
    'publishToMavenCentral()',
  ], 'packages/google module OpenIAP version and Kotlin compiler settings');
  expectNotIncludes('packages/google/openiap/build.gradle.kts', [
    '?: "1.0.0"',
    'kotlinOptions',
    'jvmTarget = "17"',
    'SonatypeHost.CENTRAL_PORTAL',
  ], 'packages/google module OpenIAP version and Kotlin compiler settings');

  const googleBillingVersions = uniqueMatches(
    googleBuildGradle,
    /val\s+playBillingVersion\s*=\s*"([^"]+)"/g,
  );
  if (googleBillingVersions.length !== 1) {
    fail(
      `packages/google must use one Play Billing version, found: ${googleBillingVersions.join(', ') || '(none)'}`,
    );
  }
  const googleGsonVersions = uniqueMatches(
    googleBuildGradle,
    /com\.google\.code\.gson:gson:([0-9.]+)/g,
  );
  if (googleGsonVersions.length !== 1) {
    fail(
      `packages/google must use one Gson version, found: ${googleGsonVersions.join(', ') || '(none)'}`,
    );
  }
  expectIncludes('packages/google/openiap/build.gradle.kts', [
    'com.android.billingclient:billing-ktx:$playBillingVersion',
  ], 'packages/google Play Billing dependency version');
  expectNotIncludes('packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt', [
    'printStackTrace()',
  ], 'Google production Store code must use structured logging');
  expectNotIncludes('packages/google/openiap/src/play/java/dev/hyo/openiap/OpenIapModule.kt', [
    'printStackTrace()',
    'TODO: In production',
    'alternativeBillingCallback?.onTokenCreated',
  ], 'Google Play production module must use structured logging');
  const googleBuildRoot = read('packages/google/build.gradle.kts');
  const googleCompileSdk = googleBuildGradle.match(/compileSdk\s*=\s*(\d+)/)?.[1];
  const googleMinSdk = googleBuildGradle.match(/minSdk\s*=\s*(\d+)/)?.[1];
  const googleAndroidGradlePluginVersion = googleBuildRoot.match(/com\.android\.library"\) version "([^"]+)"/)?.[1];
  const googleKotlinVersion = googleBuildRoot.match(/org\.jetbrains\.kotlin\.android"\) version "([^"]+)"/)?.[1];
  if (!googleCompileSdk) fail('packages/google openiap build.gradle.kts must declare compileSdk');
  if (!googleMinSdk) fail('packages/google openiap build.gradle.kts must declare minSdk');
  if (!googleAndroidGradlePluginVersion) fail('packages/google build.gradle.kts must declare Android Gradle plugin version');
  if (!googleKotlinVersion) fail('packages/google build.gradle.kts must declare Kotlin Android plugin version');
  if (googleCompileSdk && googleMinSdk && googleBillingVersions.length === 1 && googleKotlinVersion) {
    expectIncludes('packages/google/README.md', [
      `API-${googleMinSdk}%2B`,
      `api?level=${googleMinSdk}`,
      `**Minimum SDK**: ${googleMinSdk}`,
      `**Compile SDK**: ${googleCompileSdk}`,
      `**Google Play Billing**: v${googleBillingVersions[0]}`,
      `**Kotlin**: ${googleKotlinVersion}+`,
    ], 'Google README requirements');
    expectIncludes('packages/google/Example/build.gradle.kts', [
      'openIapBuildFile',
      'readOpenIapAndroidInt("compileSdk")',
      'readOpenIapAndroidInt("minSdk")',
      'readOpenIapDependencyVersion("androidx.core:core-ktx")',
      'readOpenIapDependencyVersion("androidx.lifecycle:lifecycle-runtime-ktx")',
      'readOpenIapDependencyVersion("androidx.lifecycle:lifecycle-viewmodel-ktx")',
      'readOpenIapDependencyVersion("junit:junit")',
      'compileSdk = openIapCompileSdk',
      'minSdk = openIapMinSdk',
      'targetSdk = openIapTargetSdk',
      'implementation("androidx.core:core-ktx:$openIapCoreKtxVersion")',
      'implementation("androidx.lifecycle:lifecycle-runtime-ktx:$openIapLifecycleRuntimeVersion")',
      'implementation("androidx.lifecycle:lifecycle-viewmodel-compose:$openIapLifecycleViewModelVersion")',
      'testImplementation("junit:junit:$openIapJunitVersion")',
    ], 'Google example overlapping Android versions must derive from openiap module');
    expectNotIncludes('packages/google/Example/build.gradle.kts', [
      'compileSdk = 35',
      'minSdk = 24',
      'targetSdk = 35',
      'androidx.core:core-ktx:1.13.1',
      'androidx.lifecycle:lifecycle-runtime-ktx:2.8.7',
      'androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7',
      'junit:junit:4.13.2',
    ], 'Google example overlapping Android versions must not drift from openiap module');
    expectIncludes('libraries/expo-iap/android/build.gradle', [
      'openiap-android-sdk.gradle',
      'resolvePackageJsonFile()',
      'expoIapPackageVersion',
      'version = expoIapPackageVersion',
      'versionName = expoIapPackageVersion',
      `openIapResolveAndroidSdkVersion('compileSdkVersion', 'compileSdk', ${googleCompileSdk})`,
      `openIapResolveAndroidSdkVersion('minSdkVersion', 'minSdk', ${googleMinSdk})`,
      `openIapResolveAndroidSdkVersion('targetSdkVersion', 'compileSdk', ${googleCompileSdk})`,
      'compileSdk = openIapCompileSdkVersion',
      'minSdk = openIapMinSdkVersion',
      'targetSdk = openIapTargetSdkVersion',
    ], 'Expo Android SDK versions must follow openiap-google');
    expectIncludes('libraries/expo-iap/android/openiap-android-sdk.gradle', [
      'packages/google/openiap/build.gradle.kts',
      'openIapResolveAndroidSdkVersion',
      'rootProject.ext.has(extName)',
    ], 'Expo Android SDK versions must derive from openiap-google when available');
    expectNotIncludes('libraries/expo-iap/android/build.gradle', [
      'safeExtGet("compileSdkVersion", 34)',
      'safeExtGet("targetSdkVersion", 34)',
      'compileSdkVersion openIapCompileSdkVersion',
      'minSdkVersion openIapMinSdkVersion',
      'targetSdkVersion openIapTargetSdkVersion',
      'namespace "expo.modules.iap"',
      'abortOnError false',
      'versionCode 1',
      'versionName "0.1.0"',
      "version = '0.1.0'",
      'versionName = "0.1.0"',
    ], 'Expo Android SDK fallbacks must not lag openiap-google');
    expectOptionalNotIncludes('libraries/expo-iap/example/android/build.gradle', [
      "url 'https://www.jitpack.io'",
    ], 'Expo example root Gradle must avoid deprecated Groovy property syntax');
    expectOptionalIncludes('libraries/expo-iap/example/android/app/build.gradle', [
      'compileSdk = rootProject.ext.compileSdkVersion',
      'minSdk = rootProject.ext.minSdkVersion',
      'targetSdk = rootProject.ext.targetSdkVersion',
      'namespace =',
    ], 'Expo example app Gradle SDK versions must use assignment syntax');
    expectOptionalNotIncludes('libraries/expo-iap/example/android/app/build.gradle', [
      'ndkVersion rootProject.ext.ndkVersion',
      'buildToolsVersion rootProject.ext.buildToolsVersion',
      'compileSdk rootProject.ext.compileSdkVersion',
      "namespace 'dev.hyo.martie'",
      "applicationId 'dev.hyo.martie'",
      'minSdkVersion rootProject.ext.minSdkVersion',
      'targetSdkVersion rootProject.ext.targetSdkVersion',
      'signingConfig signingConfigs.debug',
      'shrinkResources enableShrinkResources.toBoolean()',
      'crunchPngs enablePngCrunchInRelease.toBoolean()',
      'useLegacyPackaging enableLegacyPackaging.toBoolean()',
      "ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'",
    ], 'Expo example app Gradle must avoid deprecated Groovy property syntax');
    expectIncludes('libraries/flutter_inapp_purchase/android/build.gradle', [
      'locateGoogleRootBuildFile',
      'readPubspecVersion',
      'flutterPackageVersion',
      'version = flutterPackageVersion',
      "googlePluginVersion('com.android.library')",
      'openIapAndroidGradlePluginVersion',
      'openIapKotlinVersion',
      'readRequiredAndroidGradleProperty',
      "readRequiredAndroidGradleProperty(projectDir, 'openIapAndroidAnnotationVersion')",
      'classpath "com.android.tools.build:gradle:$androidGradlePluginVersion"',
      'openiap-android-sdk.gradle',
      `openIapResolveAndroidSdkVersion('compileSdkVersion', 'compileSdk', ${googleCompileSdk})`,
      `openIapResolveAndroidSdkVersion('minSdkVersion', 'minSdk', ${googleMinSdk})`,
      `openIapResolveAndroidSdkVersion('targetSdkVersion', 'compileSdk', ${googleCompileSdk})`,
      'compileSdk = openIapCompileSdkVersion',
      'minSdkVersion = openIapMinSdkVersion',
      'targetSdkVersion = openIapTargetSdkVersion',
    ], 'Flutter Android minSdk must follow openiap-google');
    expectNotIncludes('libraries/flutter_inapp_purchase/android/build.gradle', [
      "namespace 'io.github.hyochan.flutter_inapp_purchase'",
      'compileSdkVersion openIapCompileSdkVersion',
      'minSdkVersion openIapMinSdkVersion',
      'targetSdkVersion openIapTargetSdkVersion',
      'com.android.tools.build:gradle:8.7.3',
      "implementation 'androidx.annotation:annotation:1.6.0'",
      "implementation files('jars/in-app-purchasing-2.0.76.jar')",
      'openIapAmazonIapJarFile',
      "version = '1.0-SNAPSHOT'",
    ], 'Flutter Android Gradle must avoid deprecated Groovy property syntax');
    expectIncludes('libraries/flutter_inapp_purchase/example/android/app/build.gradle', [
      'openiap-android-sdk.gradle',
      'compileSdk = openIapCompileSdkVersion',
      'minSdkVersion = openIapMinSdkVersion',
      'targetSdkVersion = openIapTargetSdkVersion',
      "openIapResolveDependencyVersion('junit:junit', 'openIapJunitVersion')",
      "openIapResolveDependencyVersion('androidx.test:runner', 'openIapAndroidTestRunnerVersion')",
      "openIapResolveDependencyVersion('androidx.test.espresso:espresso-core', 'openIapEspressoCoreVersion')",
      'testImplementation "junit:junit:$openIapJunitVersion"',
      'androidTestImplementation "androidx.test:runner:$openIapAndroidTestRunnerVersion"',
      'androidTestImplementation "androidx.test.espresso:espresso-core:$openIapEspressoCoreVersion"',
      "source = '../..'",
    ], 'Flutter example Android minSdk must follow openiap-google');
    expectNotIncludes('libraries/flutter_inapp_purchase/example/android/app/build.gradle', [
      "namespace 'dev.hyo.martie'",
      'compileSdkVersion openIapCompileSdkVersion',
      'ndkVersion "27.0.12077973"',
      'applicationId "dev.hyo.martie"',
      'minSdkVersion openIapMinSdkVersion',
      'targetSdkVersion openIapTargetSdkVersion',
      "testImplementation 'junit:junit:4.13.2'",
      "androidTestImplementation 'androidx.test:runner:1.5.2'",
      "androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'",
      'signingConfig signingConfigs.debug',
      "source '../..'",
    ], 'Flutter example Android Gradle must avoid deprecated Groovy property syntax');
    expectIncludes('libraries/flutter_inapp_purchase/example/android/build.gradle', [
      'locateGoogleRootBuildFile',
      "googlePluginVersion('com.android.application')",
      'openIapAndroidGradlePluginVersion',
      'classpath "com.android.tools.build:gradle:$androidGradlePluginVersion"',
    ], 'Flutter example root Gradle plugin version must derive from packages/google');
    expectIncludes('libraries/flutter_inapp_purchase/example/android/settings.gradle', [
      'resolutionStrategy',
      'useVersion(androidGradlePluginVersion)',
      'useVersion(kotlinPluginVersion)',
      'id "com.android.application" apply false',
      'id "org.jetbrains.kotlin.android" apply false',
    ], 'Flutter example Android Gradle plugin version must derive from packages/google');
    expectIncludes('libraries/flutter_inapp_purchase/android/gradle.properties', [
      `openIapAndroidGradlePluginVersion=${googleAndroidGradlePluginVersion}`,
      `openIapKotlinVersion=${googleKotlinVersion}`,
      'openIapAndroidAnnotationVersion=',
      'openIapJunitVersion=',
    ], 'Flutter Android Gradle plugin fallback versions');
    expectIncludes('libraries/flutter_inapp_purchase/example/android/gradle.properties', [
      `openIapAndroidGradlePluginVersion=${googleAndroidGradlePluginVersion}`,
      `openIapKotlinVersion=${googleKotlinVersion}`,
      'openIapJunitVersion=',
      'openIapAndroidTestRunnerVersion=',
      'openIapEspressoCoreVersion=',
    ], 'Flutter example Android Gradle plugin fallback versions');
    expectIncludes('libraries/flutter_inapp_purchase/android/gradle/wrapper/gradle-wrapper.properties', [
      'gradle-8.13-bin.zip',
    ], 'Flutter standalone Android Gradle wrapper must support packages/google AGP');
    expectIncludes('libraries/flutter_inapp_purchase/example/android/gradle/wrapper/gradle-wrapper.properties', [
      'gradle-8.13-all.zip',
    ], 'Flutter example Android Gradle wrapper must support packages/google AGP');
    expectIncludes('libraries/godot-iap/android/settings.gradle.kts', [
      'googlePluginVersion(',
      'googleRootBuildFile',
      'configuredVersion(fallbackPropertyName)',
    ], 'Godot Android Gradle plugin versions must derive from packages/google when available');
    expectIncludes('libraries/godot-iap/android/gradle.properties', [
      `androidGradlePluginVersion=${googleAndroidGradlePluginVersion}`,
      `kotlinVersion=${googleKotlinVersion}`,
    ], 'Godot Android Gradle plugin fallback versions');
    expectIncludes('libraries/godot-iap/android/gradle/wrapper/gradle-wrapper.properties', [
      'gradle-8.13-bin.zip',
    ], 'Godot Android Gradle wrapper must support packages/google AGP');
    expectIncludes('libraries/godot-iap/android/build.gradle.kts', [
      'googleOpenIapBuildFile',
      'readGoogleAndroidInt("compileSdk", "compileSdkVersion")',
      'readGoogleAndroidInt("minSdk", "minSdkVersion")',
      'readGoogleVariable("coroutinesVersion", "kotlinxCoroutinesVersion")',
      'compileSdk = googleCompileSdk',
      'minSdk = googleMinSdk',
      'implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$googleCoroutinesVersion")',
    ], 'Godot Android SDK versions must derive from packages/google when available');
    expectNotIncludes('libraries/godot-iap/android/build.gradle.kts', [
      'compileSdk = 35',
      'minSdk = 24',
      'val kotlinxCoroutinesVersion: String by project',
      'kotlinx-coroutines-android:$kotlinxCoroutinesVersion',
    ], 'Godot Android SDK versions must not drift from packages/google');
    expectNotIncludes('libraries/godot-iap/android/settings.gradle.kts', [
      'id("com.android.library") version "8.7.2"',
      'id("org.jetbrains.kotlin.android") version "2.2.0"',
    ], 'Godot Android Gradle plugin versions must not drift from packages/google');
    expectIncludes('libraries/flutter_inapp_purchase/android/openiap-android-sdk.gradle', [
      'openIapFindGoogleOpenIapBuildFile',
      'packages/google/openiap/build.gradle.kts',
      'openIapResolveAndroidSdkVersion',
      'openIapResolveDependencyVersion',
      'openIapReadGoogleDependencyVersion',
      'rootProject.ext.has(extName)',
    ], 'Flutter Android SDK versions must derive from openiap-google when available');
    expectNotIncludes('libraries/flutter_inapp_purchase/example/android/app/src/main/AndroidManifest.xml', [
      'package="dev.hyo.martie"',
    ], 'Flutter example Android namespace must live in Gradle');
    expectNotIncludes('libraries/flutter_inapp_purchase/android/build.gradle', [
      'com.android.tools.build:gradle:8.1.4',
    ], 'Flutter standalone Android Gradle plugin must not lag compileSdk support');
    expectIncludes('libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt', [
      '@Suppress("DEPRECATION")',
      'val isAvailable = iap.checkAlternativeBillingAvailability()',
      'val token = iap.createAlternativeBillingReportingToken()',
      'val payload = JSONObject(e.toJSON())',
    ], 'Flutter Android plugin must preserve legacy alternative billing handlers');
    expectNotIncludes('libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt', [
      '@Deprecated("Deprecated channel endpoint; will be removed in 7.0.0")',
      'will be removed in 7.0.0',
      'removed in 7.0.0',
      'when (e)',
    ], 'Flutter Android plugin must not reintroduce avoidable Kotlin warnings');
    expectNotIncludes('libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/FlutterInappPurchasePlugin.kt', [
      'AmazonInappPurchasePlugin',
      'com.amazon.venezia',
      'isAppInstalledFrom',
    ], 'Flutter Android plugin must not expose standalone Amazon support');
    expectIncludes('libraries/react-native-iap/android/gradle.properties', [
      `NitroIap_minSdkVersion=${googleMinSdk}`,
    ], 'React Native Android minSdk must follow openiap-google');
    expectIncludes('packages/docs/src/lib/versioning.ts', [
      'googleCompileSdk',
      'googleMinSdk',
      'googlePlayBillingVersion',
      'export const ANDROID_SDK',
      'export const GOOGLE_PLAY_BILLING',
    ], 'docs Android SDK metadata must derive from generated docs metadata');
    expectIncludes('packages/docs/src/pages/docs/setup/expo.tsx', [
      'ANDROID_SDK',
      'GOOGLE_PLAY_BILLING',
      'GOOGLE_PLAY_BILLING.version',
      'minSdkVersion {ANDROID_SDK.minSdk}+',
      'compileSdkVersion {ANDROID_SDK.compileSdk}+',
    ], 'Expo setup Android requirements');
    expectIncludes('packages/docs/src/pages/docs/setup/flutter.tsx', [
      'ANDROID_SDK',
      'minSdkVersion ${ANDROID_SDK.minSdk}',
      'minSdk = ${ANDROID_SDK.minSdk}',
      'compileSdkVersion ${ANDROID_SDK.compileSdk}',
      'compileSdk = ${ANDROID_SDK.compileSdk}',
      'targetSdkVersion ${ANDROID_SDK.targetSdk}',
      'targetSdk = ${ANDROID_SDK.targetSdk}',
    ], 'Flutter setup Android requirements');
    expectIncludes('packages/docs/src/pages/docs/setup/react-native.tsx', [
      'ANDROID_SDK',
      'GOOGLE_PLAY_BILLING',
      'GOOGLE_PLAY_BILLING.version',
      'minSdkVersion {ANDROID_SDK.minSdk}+',
      'compileSdkVersion {ANDROID_SDK.compileSdk}+',
    ], 'React Native setup Android requirements');
    expectIncludes('packages/docs/src/pages/docs/horizon-setup.tsx', [
      'OPENIAP_VERSIONS',
      'OPENIAP_VERSIONS.google',
    ], 'Horizon setup docs must use current openiap-google version metadata');
    expectNotIncludes('packages/docs/src/pages/docs/horizon-setup.tsx', [
      'openiap-google@1.3.2',
    ], 'Horizon setup docs must not hardcode stale openiap-google versions');
    expectNotIncludes('packages/docs/src/pages/docs/setup/react-native.tsx', [
      'Google Play Billing 8.0+',
      'compileSdkVersion 34+',
    ], 'React Native setup Android requirements must not use stale Google requirements');
    for (const docsSetupFile of [
      'packages/docs/src/pages/docs/setup/expo.tsx',
      'packages/docs/src/pages/docs/setup/flutter.tsx',
      'packages/docs/src/pages/docs/setup/react-native.tsx',
    ]) {
      expectNotIncludes(docsSetupFile, [
        `Google Play Billing Library v${googleBillingVersions[0]}`,
        `Google Play Billing ${googleBillingVersions[0]}+`,
        `minSdkVersion ${googleMinSdk}+`,
        `compileSdkVersion ${googleCompileSdk}+`,
        `minSdkVersion ${googleMinSdk}`,
        `compileSdkVersion ${googleCompileSdk}`,
        `targetSdkVersion ${googleCompileSdk}`,
        `minSdk = ${googleMinSdk}`,
        `compileSdk = ${googleCompileSdk}`,
        `targetSdk = ${googleCompileSdk}`,
      ], `${docsSetupFile} Android SDK values must derive from versioning.ts`);
    }
    expectIncludes('libraries/expo-iap/plugin/src/withLocalOpenIAP.ts', [
      'resolveAndroidGradlePluginVersions(androidModulePath)',
      'relativeAndroidModulePath',
      "new File(settingsDir, '${relativeAndroidModulePath}')",
      'projectDirPattern',
      'injectPluginManagement();',
      'readGradlePluginVersion(contents,',
      'setGradlePluginVersion(',
      "vanniktechMavenPublish: '0.35.0'",
      'pluginVersions.vanniktechMavenPublish',
      'pluginVersions.kotlin',
    ], 'Expo local OpenIAP plugin Gradle plugin versions');
    expectOptionalIncludes('libraries/expo-iap/plugin/build/withLocalOpenIAP.js', [
      'relativeAndroidModulePath',
      "new File(settingsDir, '${relativeAndroidModulePath}')",
      'projectDirPattern',
      'injectPluginManagement();',
    ], 'Expo local OpenIAP plugin build output');
    expectNotIncludes('libraries/expo-iap/plugin/src/withLocalOpenIAP.ts', [
      'version "0.29.0"',
      "new File('${androidModulePath",
    ], 'Expo local OpenIAP plugin Gradle plugin versions must not drift from packages/google');
    expectOptionalIncludes('libraries/expo-iap/example/android/settings.gradle', [
      'id("com.vanniktech.maven.publish") version "0.35.0"',
      'id("org.jetbrains.kotlin.android") version "2.2.0"',
      'id("org.jetbrains.kotlin.plugin.compose") version "2.2.0"',
      "project(':openiap-google').projectDir = new File(settingsDir, '../../../../packages/google/openiap')",
    ], 'Expo example local OpenIAP plugin versions');
    expectOptionalNotIncludes('libraries/expo-iap/example/android/settings.gradle', [
      'version "0.29.0"',
      'version "2.0.21"',
    ], 'Expo example local OpenIAP plugin versions must not drift');
    expectIncludes('libraries/kmp-iap/gradle/libs.versions.toml', [
      'vanniktech-publish = "0.35.0"',
    ], 'KMP Vanniktech publish plugin version');
    expectIncludes('libraries/kmp-iap/example/gradle/libs.versions.toml', [
      'vanniktech-publish = "0.35.0"',
    ], 'KMP example Vanniktech publish plugin version');
    expectIncludes('libraries/kmp-iap/library/build.gradle.kts', [
      'publishToMavenCentral()',
    ], 'KMP Vanniktech publish target');
    expectIncludes('libraries/kmp-iap/library/build.gradle.kts', [
      'url.set("https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap")',
      'name.set("Apache License 2.0")',
      'url.set("https://www.apache.org/licenses/LICENSE-2.0")',
      'organization.set("hyodotdev")',
      'organizationUrl.set("https://github.com/hyodotdev")',
      'connection.set("scm:git:https://github.com/hyodotdev/openiap.git")',
      'developerConnection.set("scm:git:ssh://git@github.com/hyodotdev/openiap.git")',
      'tag.set("kmp-iap-$kmpIapLibraryVersion")',
      'url.set("https://github.com/hyodotdev/openiap/issues")',
    ], 'KMP Maven metadata must point at the monorepo and local license');
    expectNotIncludes('libraries/kmp-iap/library/build.gradle.kts', [
      'github.com/hyochan/kmp-iap',
      'name.set("MIT License")',
      'https://opensource.org/licenses/MIT',
      'tag.set("v$kmpIapLibraryVersion")',
    ], 'KMP Maven metadata must not point at the legacy standalone repository');
    expectIncludes('libraries/kmp-iap/library/build.gradle.kts', [
      'fun dynamicKmpPodspec(): String',
      'tasks.matching { it.name == "podspec" }.configureEach',
      'dynamicKmpPodspec()',
    ], 'KMP CocoaPods generated podspec must be post-processed by Gradle');
    expectIncludes('libraries/kmp-iap/library/library.podspec', [
      'gradle_properties_file',
      'libraryVersion=',
      'spec.version                  = library_version',
      'kmp-iap-#{library_version}',
    ], 'KMP CocoaPods spec version must follow gradle.properties');
    expectNotIncludes('libraries/kmp-iap/library/library.podspec', [
      "spec.version                  = '2.2.8'",
      "spec.source                   = { :http=> ''}",
      "spec.authors                  = ''",
      "spec.license                  = ''",
    ], 'KMP CocoaPods spec version must not drift from gradle.properties');
    expectIncludes('libraries/kmp-iap/publish-local.sh', [
      'set -euo pipefail',
      'read_prop()',
      'ORG_GRADLE_PROJECT_signingInMemoryKey',
      'ORG_GRADLE_PROJECT_signingInMemoryKeyFile',
      ':library:publishAndReleaseToMavenCentral',
    ], 'KMP local Maven Central publish script');
    expectNotIncludes('libraries/kmp-iap/publish-local.sh', [
      'source local.properties',
      '. local.properties',
    ], 'KMP local Maven Central publish script must not source local.properties');
    expectIncludes('libraries/kmp-iap/scripts/publish-local.sh', [
      'set -euo pipefail',
      '-PlibraryVersion="$VERSION"',
    ], 'KMP Maven Local publish script');
    expectIncludes('libraries/kmp-iap/scripts/build-all.sh', [
      'set -euo pipefail',
    ], 'KMP build-all script must fail on unset vars and pipeline failures');
    expectNotIncludes('libraries/kmp-iap/scripts/publish-local.sh', [
      'echo "libraryVersion=$VERSION" > local.properties',
    ], 'KMP Maven Local publish script must not overwrite local.properties');
    expectIncludes('libraries/kmp-iap/local.properties.template', [
      'mavenCentralUsername=your-central-portal-username',
      'mavenCentralPassword=your-central-portal-password',
      'signingInMemoryKeyId=',
      'signingInMemoryKeyPassword=',
      'signingInMemoryKeyFile=',
    ], 'KMP local.properties template');
    expectIncludes('libraries/kmp-iap/gradle.properties.template', [
      'mavenCentralUsername=your-central-portal-username',
      'mavenCentralPassword=your-central-portal-password',
      'signingInMemoryKeyId=',
      'signingInMemoryKeyPassword=',
      'signingInMemoryKeyFile=',
    ], 'KMP gradle.properties template');
    for (const staleKmpSigningFile of [
      'libraries/kmp-iap/local.properties.template',
      'libraries/kmp-iap/gradle.properties.template',
      'libraries/kmp-iap/gradle.properties',
    ]) {
      expectNotIncludes(staleKmpSigningFile, [
        'signing.keyId',
        'signing.password',
        'signing.secretKeyRingFile',
        'signing.gnupg.keyName',
        'signing.gnupg.passphrase',
        'your-sonatype-username',
        'your-sonatype-password',
      ], `${staleKmpSigningFile} must use current Vanniktech signing properties`);
    }
    expectIncludes('packages/google/scripts/publish-local.sh', [
      ':openiap:publishAndReleaseToMavenCentral',
    ], 'Google local publish Central Portal task');
    expectNotIncludes('libraries/kmp-iap/gradle/libs.versions.toml', [
      'vanniktech-publish = "0.29.0"',
      'vanniktech-publish = "0.34.0"',
      'vanniktech-publish = "0.36.0"',
    ], 'KMP Vanniktech publish plugin version must not use deprecated plugin');
    expectNotIncludes('libraries/kmp-iap/example/gradle/libs.versions.toml', [
      'vanniktech-publish = "0.29.0"',
      'vanniktech-publish = "0.34.0"',
      'vanniktech-publish = "0.36.0"',
    ], 'KMP example Vanniktech publish plugin version must not use deprecated plugin');
    expectNotIncludes('libraries/kmp-iap/library/build.gradle.kts', [
      'SonatypeHost.CENTRAL_PORTAL',
      '"sonatypeRepositoryId"',
      '"sonatypeAutomaticRelease"',
    ], 'KMP Vanniktech publish target must use Central Portal default API');
    for (const publishingFile of [
      'libraries/kmp-iap/gradle.properties',
      'libraries/kmp-iap/publish-local.sh',
      'packages/google/scripts/publish-local.sh',
    ]) {
      expectNotIncludes(publishingFile, [
        'SONATYPE_HOST',
        'sonatypeHost',
        'sonatypeRepositoryId',
        'sonatypeAutomaticRelease',
        'SONATYPE_AUTOMATIC_RELEASE',
        'mavenCentralStagingProfileId',
        'sonatypeStagingProfileId',
        'ORG_GRADLE_PROJECT_mavenCentralPublishing',
        'ORG_GRADLE_PROJECT_signAllPublications',
      ], `${publishingFile} must not use legacy Sonatype host properties`);
    }
  }

  const horizonBillingVersions = uniqueMatches(
    googleBuildGradle,
    /val\s+horizonBillingCompatibilityVersion\s*=\s*"([^"]+)"/g,
  );
  if (horizonBillingVersions.length !== 1) {
    fail(
      `packages/google must use one Horizon Billing Compatibility version, found: ${horizonBillingVersions.join(', ') || '(none)'}`,
    );
  }
  expectIncludes('packages/google/openiap/build.gradle.kts', [
    'com.meta.horizon.platform.ovr:android-platform-sdk:$horizonPlatformVersion',
    'com.meta.horizon.billingclient.api:horizon-billing-compatibility:$horizonBillingCompatibilityVersion',
  ], 'packages/google Horizon dependency versions');

  const mauiProps = read('libraries/maui-iap/src/Directory.Build.props');
  const mauiBillingVersion = mauiProps.match(/<MauiPlayBillingVersion>([^<]+)<\/MauiPlayBillingVersion>/)?.[1];
  const mauiGsonVersion = mauiProps.match(/<MauiGsonVersion>([^<]+)<\/MauiGsonVersion>/)?.[1];
  const mauiBillingClientNuGetVersion = mauiProps.match(/<MauiBillingClientNuGetVersion>([^<]+)<\/MauiBillingClientNuGetVersion>/)?.[1];
  const mauiGoogleGsonNuGetVersion = mauiProps.match(/<MauiGoogleGsonNuGetVersion>([^<]+)<\/MauiGoogleGsonNuGetVersion>/)?.[1];
  const mauiAndroidXActivityVersion = mauiProps.match(/<MauiAndroidXActivityVersion>([^<]+)<\/MauiAndroidXActivityVersion>/)?.[1];
  const mauiAndroidXFragmentVersion = mauiProps.match(/<MauiAndroidXFragmentVersion>([^<]+)<\/MauiAndroidXFragmentVersion>/)?.[1];
  const mauiAndroidXLifecycleVersion = mauiProps.match(/<MauiAndroidXLifecycleVersion>([^<]+)<\/MauiAndroidXLifecycleVersion>/)?.[1];
  const mauiAndroidXSavedStateVersion = mauiProps.match(/<MauiAndroidXSavedStateVersion>([^<]+)<\/MauiAndroidXSavedStateVersion>/)?.[1];
  expectIncludes('scripts/sync-versions.sh', [
    'sync_maui_android_versions',
    'packages/google/openiap/build.gradle.kts',
    'MauiPlayBillingVersion',
    'MauiBillingClientNuGetVersion',
    'MauiGoogleGsonNuGetVersion',
    'MauiAndroidXActivityVersion',
    'MauiAndroidXLifecycleVersion',
    'mauiGsonVersion',
  ], 'root version sync must update MAUI Android dependency versions from packages/google');
  expectIncludes('libraries/maui-iap/src/Directory.Build.props', [
    'Generated by scripts/sync-versions.sh',
    'MauiPlayBillingVersion',
    'MauiGsonVersion',
    'MauiBillingClientNuGetVersion',
    'MauiGoogleGsonNuGetVersion',
    'MauiAndroidXActivityVersion',
    'MauiAndroidXFragmentVersion',
    'MauiAndroidXLifecycleVersion',
    'MauiAndroidXSavedStateVersion',
  ], 'MAUI Directory.Build.props must be generated by version sync');
  if (!mauiBillingVersion) {
    fail('MAUI Directory.Build.props must define MauiPlayBillingVersion');
  }
  if (!mauiGsonVersion) {
    fail('MAUI Directory.Build.props must define MauiGsonVersion');
  }
  if (!mauiBillingClientNuGetVersion) {
    fail('MAUI Directory.Build.props must define MauiBillingClientNuGetVersion');
  }
  if (!mauiGoogleGsonNuGetVersion) {
    fail('MAUI Directory.Build.props must define MauiGoogleGsonNuGetVersion');
  }
  if (!mauiAndroidXActivityVersion) {
    fail('MAUI Directory.Build.props must define MauiAndroidXActivityVersion');
  }
  if (!mauiAndroidXFragmentVersion) {
    fail('MAUI Directory.Build.props must define MauiAndroidXFragmentVersion');
  }
  if (!mauiAndroidXLifecycleVersion) {
    fail('MAUI Directory.Build.props must define MauiAndroidXLifecycleVersion');
  }
  if (!mauiAndroidXSavedStateVersion) {
    fail('MAUI Directory.Build.props must define MauiAndroidXSavedStateVersion');
  }
  if (googleBillingVersions.length === 1) {
    if (mauiBillingVersion !== googleBillingVersions[0]) {
      fail(
        `MAUI Android Billing Maven version ${mauiBillingVersion} must match packages/google ${googleBillingVersions[0]}`,
      );
    }
    if (
      mauiBillingClientNuGetVersion &&
      mauiBillingClientNuGetVersion !== googleBillingVersions[0] &&
      !mauiBillingClientNuGetVersion.startsWith(`${googleBillingVersions[0]}.`)
    ) {
      fail(
        `MAUI Android BillingClient NuGet version ${mauiBillingClientNuGetVersion} must track packages/google ${googleBillingVersions[0]}`,
      );
    }
  }
  if (googleGsonVersions.length === 1) {
    if (mauiGsonVersion !== googleGsonVersions[0]) {
      fail(
        `MAUI Android Gson Maven version ${mauiGsonVersion} must match packages/google ${googleGsonVersions[0]}`,
      );
    }
    const mauiAndroidGradleProperties = read('libraries/maui-iap/android/gradle.properties');
    const mauiAndroidGsonVersion =
      mauiAndroidGradleProperties.match(/^mauiGsonVersion=(.+)$/m)?.[1];
    if (!mauiAndroidGsonVersion) {
      fail('MAUI Android gradle.properties must define mauiGsonVersion');
    } else if (mauiAndroidGsonVersion !== googleGsonVersions[0]) {
      fail(
        `MAUI Android Gradle Gson version ${mauiAndroidGsonVersion} must match packages/google ${googleGsonVersions[0]}`,
      );
    }
  }
  expectIncludes('libraries/maui-iap/android/openiap/build.gradle.kts', [
    'googleOpenIapBuildFile',
    'readGoogleAndroidInt("compileSdk")',
    'readGoogleAndroidInt("minSdk")',
    'readMauiAndroidMinSdk()',
    'readGoogleDependencyVersion("androidx.core:core-ktx")',
    'readGoogleVariable("coroutinesVersion")',
    'compileSdk = googleCompileSdk',
    'minSdk = maxOf(googleMinSdk, mauiAndroidMinSdk)',
    'mauiGsonVersion',
    'implementation("androidx.core:core-ktx:$googleCoreKtxVersion")',
    'com.google.code.gson:gson:$gsonVersion',
    'implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$googleCoroutinesVersion")',
  ], 'MAUI Android facade Gson dependency version');
  expectIncludes('libraries/maui-iap/android/settings.gradle.kts', [
    'googleRootBuildFile',
    'googlePluginVersion("com.android.library")',
    'googlePluginVersion("org.jetbrains.kotlin.android")',
  ], 'MAUI Android Gradle plugin versions must derive from packages/google');
  expectIncludes('libraries/maui-iap/android/build.gradle.kts', [
    'id("com.android.library") apply false',
    'id("org.jetbrains.kotlin.android") apply false',
  ], 'MAUI Android root Gradle plugins');
  expectNotIncludes('libraries/maui-iap/android/openiap/build.gradle.kts', [
    'compileSdk = 35',
    'minSdk = 24',
    'androidx.core:core-ktx:1.13.1',
    'kotlinx-coroutines-android:1.9.0',
  ], 'MAUI Android facade versions must derive from openiap-google and MAUI metadata');
  for (const mauiGradlePluginFile of [
    'libraries/maui-iap/android/settings.gradle.kts',
    'libraries/maui-iap/android/build.gradle.kts',
  ]) {
    expectNotIncludes(mauiGradlePluginFile, [
      'version "8.7.3"',
      'version "8.13.2"',
      'version "2.2.0"',
    ], `${mauiGradlePluginFile} must not hardcode Google Gradle plugin versions`);
  }
  expectIncludes('libraries/maui-iap/src/OpenIap.Maui.Bindings.Android/OpenIap.Maui.Bindings.Android.csproj', [
    'Xamarin.Android.Google.BillingClient',
    'Version="$(MauiBillingClientNuGetVersion)"',
    'GoogleGson',
    'Version="$(MauiGoogleGsonNuGetVersion)"',
    'Version="$(MauiKotlinStdLibVersion)"',
    'Version="$(MauiKotlinCoroutinesVersion)"',
  ], 'MAUI Android binding dependency versions');
  expectNotIncludes('libraries/maui-iap/src/OpenIap.Maui.Bindings.Android/OpenIap.Maui.Bindings.Android.csproj', [
    '<AndroidMavenLibrary Include=',
    'Version="3.0.0"',
    'Version="3.1.8"',
    'Version="18.5.0"',
    'Version="18.9.0"',
    'Version="19.0.0"',
    'Version="18.2.0"',
  ], 'MAUI Android binding Google Maven dependencies must use shared props');
  expectIncludes('libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj', [
    'net10.0',
    'net10.0-android',
    'net10.0-ios',
    'net10.0-maccatalyst',
    'Xamarin.Android.Google.BillingClient',
    'Version="$(MauiBillingClientNuGetVersion)"',
    'GoogleGson',
    'Version="$(MauiGoogleGsonNuGetVersion)"',
    'Xamarin.AndroidX.Activity.Ktx',
    'Version="$(MauiAndroidXActivityVersion)"',
    'Xamarin.AndroidX.Fragment.Ktx',
    'Version="$(MauiAndroidXFragmentVersion)"',
    'Xamarin.AndroidX.Lifecycle.Runtime.Ktx',
    'Version="$(MauiAndroidXLifecycleVersion)"',
    'Xamarin.AndroidX.SavedState.SavedState.Ktx',
    'Version="$(MauiAndroidXSavedStateVersion)"',
    'Version="$(MauiKotlinStdLibVersion)"',
    'Version="$(MauiKotlinCoroutinesVersion)"',
    'openiap-release.aar',
    'openiap-play-release.aar',
  ], 'MAUI Android package dependency versions');
  expectNotIncludes('libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj', [
    '<BuildOutputInPackage Include="$(OutputPath)*.aar"',
  ], 'MAUI package must not fat-bundle transitive Google AARs');
  expectIncludes('libraries/maui-iap/example/OpenIap.Maui.Example/OpenIap.Maui.Example.csproj', [
    'net10.0-android',
    'net10.0-ios',
    'net10.0-maccatalyst',
    'Version="10.0.*"',
  ], 'MAUI example app must validate net10 target frameworks');
  for (const mauiWorkflow of [
    '.github/workflows/ci-maui-iap.yml',
    '.github/workflows/release-maui.yml',
  ]) {
    expectIncludes(mauiWorkflow, [
      'dotnet-version: "10.0.x"',
      'net10.0',
      'net10.0-android',
      'net10.0-ios',
      'net10.0-maccatalyst',
    ], 'MAUI workflows must validate net10 target frameworks');
  }
  expectIncludes('packages/docs/src/pages/docs/setup/maui.tsx', [
    '.NET 9 or .NET 10 SDK',
    'Google Billing, Play',
    'net10.0-ios;net10.0-android;net10.0-maccatalyst',
    'Replace <code>net9.0-*</code> with <code>net10.0-*</code>',
  ], 'MAUI setup docs must describe net10 and NuGet Google dependency shape');
  expectIncludes('libraries/flutter_inapp_purchase/android/settings.gradle', [
    "new File(settingsDir, '../../../packages/google/openiap')",
  ], 'Flutter Android local OpenIAP module hint');
  expectNotIncludes('libraries/flutter_inapp_purchase/android/settings.gradle', [
    'git clone https://github.com/hyodotdev/openiap-google',
    '/path/to/openiap/packages/google/openiap',
    'switch dependency',
  ], 'Flutter Android local OpenIAP module hint must match monorepo flow');
  expectIncludes('libraries/flutter_inapp_purchase/CONTRIBUTING.md', [
    "project(':openiap').projectDir = new File(settingsDir, '../../../packages/google/openiap')",
    '`android/build.gradle` dependency changes are needed.',
  ], 'Flutter local OpenIAP debugging docs');
  expectNotIncludes('libraries/flutter_inapp_purchase/CONTRIBUTING.md', [
    'git clone https://github.com/hyodotdev/openiap-google',
    'debugImplementation project(":openiap")',
    'releaseImplementation "io.github.hyochan.openiap:openiap-google:${openiapGoogleVersion}"',
  ], 'Flutter local OpenIAP debugging docs must match automatic local project selection');

  for (const [label, filePath] of [
    ['React Native Android', 'libraries/react-native-iap/android/build.gradle'],
    ['MAUI Android', 'libraries/maui-iap/android/openiap/build.gradle.kts'],
    ['Godot Android GDAP', 'libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap'],
  ]) {
    const coroutineVersions = uniqueMatches(
      read(filePath),
      /kotlinx-coroutines-android:([0-9.]+)/g,
    );
    for (const version of coroutineVersions) {
      if (googleCoroutineVersions.length === 1 && version !== googleCoroutineVersions[0]) {
        fail(
          `${label} coroutines version ${version} must match packages/google ${googleCoroutineVersions[0]}`,
        );
      }
    }
  }
  if (googleCoroutineVersions.length === 1) {
    expectIncludes('libraries/react-native-iap/android/gradle.properties', [
      `NitroIap_coroutinesVersion=${googleCoroutineVersions[0]}`,
      'NitroIap_playServicesBaseVersion=',
      'NitroIap_junitVersion=',
    ], 'React Native Android coroutines fallback version');
  }
  expectIncludes('libraries/react-native-iap/android/build.gradle', [
    'googleRootBuildFile',
    "googlePluginVersion('com.android.library')",
    "googlePluginVersion('org.jetbrains.kotlin.android')",
    'NitroIap_androidGradlePluginVersion',
    'resolveOpenIapGoogleBuildFile()',
    "readOpenIapGoogleVariable(googleOpenIapBuildFile, 'coroutinesVersion')",
    "readOpenIapGoogleDependencyVersion(googleOpenIapBuildFile, 'junit:junit')",
    'def playServicesBaseVersion = getExtOrDefault("playServicesBaseVersion")',
    'def junitVersion = readOpenIapGoogleDependencyVersion',
    'implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion"',
    'implementation "com.google.android.gms:play-services-base:$playServicesBaseVersion"',
    'testImplementation "junit:junit:$junitVersion"',
    'namespace = "com.margelo.nitro.iap"',
    'buildConfig = true',
    'prefab = true',
  ], 'React Native Android Gradle versions and syntax');
  expectNotIncludes('libraries/react-native-iap/android/build.gradle', [
    'com.android.tools.build:gradle:8.12.1',
    'org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.0',
    "implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0'",
    "implementation 'com.google.android.gms:play-services-base:18.5.0'",
    "testImplementation 'junit:junit:4.13.2'",
    'namespace "com.margelo.nitro.iap"',
    'ndkVersion getExtOrDefault("ndkVersion")',
    'minSdkVersion getExtOrIntegerDefault("minSdkVersion")',
    'targetSdkVersion getExtOrIntegerDefault("targetSdkVersion")',
    'buildConfig true',
    'prefab true',
  ], 'React Native Android Gradle must avoid hardcoded drift and deprecated syntax');
  expectIncludes('libraries/react-native-iap/example/android/app/build.gradle', [
    'ndkVersion = rootProject.ext.ndkVersion',
    'compileSdk = rootProject.ext.compileSdkVersion',
    'namespace = "dev.hyo.martie"',
    'signingConfig = signingConfigs.debug',
  ], 'React Native example Android Gradle syntax');
  expectNotIncludes('libraries/react-native-iap/example/android/app/build.gradle', [
    'ndkVersion rootProject.ext.ndkVersion',
    'compileSdk rootProject.ext.compileSdkVersion',
    'namespace "dev.hyo.martie"',
    'signingConfig signingConfigs.debug',
  ], 'React Native example Android Gradle must avoid deprecated syntax');

  for (const gradleFile of [
    'libraries/expo-iap/android/build.gradle',
    'libraries/flutter_inapp_purchase/example/android/app/build.gradle',
    'libraries/flutter_inapp_purchase/android/build.gradle',
    'libraries/godot-iap/android/build.gradle.kts',
    'libraries/maui-iap/android/openiap/build.gradle.kts',
    'libraries/react-native-iap/android/build.gradle',
    'packages/google/Example/build.gradle.kts',
    'packages/google/openiap/build.gradle.kts',
  ]) {
    expectIncludes(gradleFile, [
      'compilerOptions',
      'JvmTarget.JVM_17',
    ], `${gradleFile} Kotlin compiler target`);
    expectNotIncludes(gradleFile, [
      'kotlinOptions',
      'jvmTarget = "17"',
      "jvmTarget = '17'",
    ], `${gradleFile} Kotlin compiler target`);
  }

  for (const kotlinVersionFile of [
    'libraries/expo-iap/plugin/src/withLocalOpenIAP.ts',
    'libraries/flutter_inapp_purchase/android/gradle.properties',
    'libraries/flutter_inapp_purchase/example/android/gradle.properties',
    'libraries/flutter_inapp_purchase/example/android/settings.gradle',
    'libraries/godot-iap/android/gradle.properties',
    'libraries/react-native-iap/android/gradle.properties',
    'libraries/react-native-iap/README.md',
  ]) {
    expectIncludes(kotlinVersionFile, [
      '2.2.0',
    ], `${kotlinVersionFile} Kotlin version`);
    expectNotIncludes(kotlinVersionFile, [
      '2.0.21',
      '2.1.20',
      '2.1.0',
    ], `${kotlinVersionFile} Kotlin version`);
  }
  for (const kotlinVersionFile of [
    'libraries/expo-iap/plugin/build/withLocalOpenIAP.js',
  ]) {
    expectOptionalIncludes(kotlinVersionFile, [
      '2.2.0',
    ], `${kotlinVersionFile} Kotlin version`);
    expectOptionalNotIncludes(kotlinVersionFile, [
      '2.0.21',
      '2.1.20',
      '2.1.0',
    ], `${kotlinVersionFile} Kotlin version`);
  }
  expectIncludes('libraries/flutter_inapp_purchase/android/build.gradle', [
    "readRequiredAndroidGradleProperty(projectDir, 'openIapKotlinVersion')",
  ], 'Flutter Android build.gradle must read Kotlin fallback from gradle.properties');
  expectIncludes('libraries/react-native-iap/android/build.gradle', [
    "configuredVersion('kotlinVersion', 'NitroIap_kotlinVersion')",
  ], 'React Native Android build.gradle must read Kotlin fallback from gradle.properties');
  expectIncludes('packages/apple/Sources/OpenIapVersion.swift', [
    'Bundle.module.url(forResource: "openiap-versions", withExtension: "json")',
    'cocoaPodsVersionURL()',
    'bundle.url(forResource: "OpenIAP", withExtension: "bundle")',
    'version(for: "apple")',
    'version(for: "spec")',
  ], 'Apple OpenIAP runtime version');
  expectIncludes('packages/apple/openiap.podspec', [
    's.resources',
    'Sources/openiap-versions.json',
    'openiap-versions.json',
  ], 'Apple podspec version resource');
  expectNotIncludes('packages/apple/Sources/OpenIapVersion.swift', [
    '1.2.23',
    '1.2.2',
    'static let current',
    'static let gqlVersion',
  ], 'Apple OpenIAP runtime version');
  expectIncludes('packages/apple/wrapper/project.yml', [
    'MARKETING_VERSION: "$(OPENIAP_MARKETING_VERSION)"',
  ], 'Apple wrapper marketing version');
  expectIncludes('packages/apple/scripts/build-xcframework.sh', [
    'openiap-versions.json',
    'read_openiap_version()',
    'python3 - "$VERSIONS_FILE" "$1"',
    'APPLE_VERSION="$(read_openiap_version apple)"',
    'OPENIAP_MARKETING_VERSION="${APPLE_VERSION}"',
  ], 'Apple xcframework marketing version');
  expectIncludes('packages/apple/scripts/build-xcframework.sh', [
    'EXPECTED_INSTALL_NAME="@rpath/OpenIAP.framework/OpenIAP"',
    'LD_DYLIB_INSTALL_NAME="${EXPECTED_INSTALL_NAME}"',
    'validate_install_names',
  ], 'Apple xcframework install name');
  expectIncludes('packages/apple/wrapper/project.yml', [
    'LD_DYLIB_INSTALL_NAME: "@rpath/$(EXECUTABLE_PATH)"',
  ], 'Apple wrapper install name');
  expectNotIncludes('packages/apple/scripts/bump-version.sh', [
    'OpenIapVersion.swift fallback',
    'Sources/OpenIapVersion.swift',
  ], 'Apple bump-version should not edit runtime version source');
}

checkLibraryCoverageRegistry();
checkExpoSsotRegistry();
checkGeneratedTypeSync();
checkGqlRuntimeExports();
checkOperationRegistry();
checkExpoRouterExample('libraries/expo-iap/example', 'src/utils/constants.ts');
checkReactNativeClassic();
checkFlutter();
checkKmp();
checkApple();
checkGoogle();
checkMaui();
checkNativeApis();
checkFrameworkDependencyHygiene();
expectNoExampleStorefrontIOS();

if (failures.length > 0) {
  console.error(`Non-Godot parity audit failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Non-Godot example/API/test parity audit passed.');
