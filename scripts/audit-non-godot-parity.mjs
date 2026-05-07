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
    'libraries/react-native-iap/example-expo',
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
  expectIncludes(rel(base, 'Sources/OpenIapProtocol.swift'), ['func getStorefront()'], 'Apple protocol');
  expectIncludes(rel(base, 'Sources/OpenIapStore.swift'), ['func getStorefront()'], 'Apple store');
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

checkLibraryCoverageRegistry();
checkExpoSsotRegistry();
checkGeneratedTypeSync();
checkOperationRegistry();
checkExpoRouterExample('libraries/expo-iap/example', 'src/utils/constants.ts');
checkExpoRouterExample('libraries/react-native-iap/example-expo', 'constants/products.ts');
checkReactNativeClassic();
checkFlutter();
checkKmp();
checkApple();
checkGoogle();
checkMaui();
checkNativeApis();
expectNoExampleStorefrontIOS();

if (failures.length > 0) {
  console.error(`Non-Godot parity audit failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Non-Godot example/API/test parity audit passed.');
