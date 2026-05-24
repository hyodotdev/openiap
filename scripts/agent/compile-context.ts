/**
 * Claude Code Context Compiler (No Ollama Required)
 *
 * This script compiles all knowledge files into a single context.md file
 * that can be used with Claude Code's --context flag.
 *
 * Usage:
 *   bun run compile
 *
 * Output:
 *   knowledge/_claude-context/context.md
 *
 * Then use with Claude Code:
 *   claude --context knowledge/_claude-context/context.md
 */

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import chalk from "chalk";

// ============================================================================
// Configuration
// ============================================================================

// Use script directory instead of process.cwd() for stable path resolution
// Note: import.meta.dir is Bun-specific, use fileURLToPath for Node.js compatibility
import { fileURLToPath } from "url";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  projectRoot: path.resolve(scriptDir, "../.."),
  knowledgeRoot: path.resolve(scriptDir, "../../knowledge"),
  outputDir: path.resolve(scriptDir, "../../knowledge/_claude-context"),
  outputFile: "context.md",
  // LLMs.txt output (for AI assistants on web)
  llmsOutputDir: path.resolve(scriptDir, "../../packages/docs/public"),
  rootLlmsSymlinks: {
    "llms.txt": "packages/docs/public/llms.txt",
    "llms-full.txt": "packages/docs/public/llms-full.txt",
  },
};

type LlmsVersions = {
  apple: string;
  flutter: string;
  google: string;
  godot: string;
  kmp: string;
  maui: string;
  mauiPackageId: string;
};

function readJsonFile<T>(relativePath: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(CONFIG.projectRoot, relativePath), "utf-8"),
  ) as T;
}

function readRegexVersion(
  relativePath: string,
  pattern: RegExp,
  label: string,
): string {
  const content = fs.readFileSync(
    path.join(CONFIG.projectRoot, relativePath),
    "utf-8",
  );
  const version = content.match(pattern)?.[1]?.trim();
  if (!version) {
    throw new Error(`Unable to resolve ${label} version from ${relativePath}`);
  }
  return version;
}

function readInstallationVersions(): LlmsVersions {
  const openiapVersions = readJsonFile<{ apple: string; google: string }>(
    "openiap-versions.json",
  );

  return {
    apple: openiapVersions.apple,
    google: openiapVersions.google,
    flutter: readRegexVersion(
      "libraries/flutter_inapp_purchase/pubspec.yaml",
      /^version:\s*([^\s]+)/m,
      "flutter_inapp_purchase",
    ),
    godot: readRegexVersion(
      "libraries/godot-iap/addons/godot-iap/plugin.cfg",
      /^version="([^"]+)"$/m,
      "godot-iap",
    ),
    kmp: readRegexVersion(
      "libraries/kmp-iap/gradle.properties",
      /^libraryVersion=(.+)$/m,
      "kmp-iap",
    ),
    maui: readRegexVersion(
      "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
      /<PackageVersion>([^<]+)<\/PackageVersion>/,
      "OpenIap.Maui",
    ),
    mauiPackageId: readRegexVersion(
      "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
      /<PackageId>([^<]+)<\/PackageId>/,
      "OpenIap.Maui package id",
    ),
  };
}

function withFinalNewline(content: string): string {
  return `${content.trimEnd()}\n`;
}

function ensureSymlink(linkPath: string, targetPath: string): void {
  try {
    const currentTarget = fs.readlinkSync(linkPath);
    if (currentTarget === targetPath) {
      return;
    }
    fs.unlinkSync(linkPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "EINVAL") {
      throw error;
    }
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
    }
  }

  fs.symlinkSync(targetPath, linkPath);
}

// ============================================================================
// LLMs.txt Generator
// ============================================================================

async function generateLlmsTxt(): Promise<{ quick: number; full: number }> {
  console.log(chalk.blue("\n🤖 Generating llms.txt files...\n"));
  const versions = readInstallationVersions();
  const generatedAt = new Date().toISOString();

  // Read all external API docs
  const externalFiles = await glob(
    path.join(CONFIG.knowledgeRoot, "external/**/*.md"),
    { absolute: true },
  );

  // Combine all external docs for llms-full.txt
  let fullContent = `# OpenIAP Complete Reference

> OpenIAP: Unified in-app purchase specification for iOS & Android
> Documentation: https://openiap.dev
> Quick Reference: https://openiap.dev/llms.txt
> Generated: ${generatedAt}

## Table of Contents
1. Installation
2. Core APIs (Connection, Products, Purchase, Subscription)
3. Platform-Specific APIs (iOS, Android)
4. Store Targets (Play, Horizon, Fire OS, Vega OS)
5. Types Reference
6. Error Codes & Handling
7. Implementation Patterns

---

## 1. Installation

### React Native / Expo
\`\`\`bash
# expo-iap (Expo projects - recommended)
npx expo install expo-iap

# react-native-iap (React Native CLI)
npm install react-native-iap
cd ios && pod install
\`\`\`

### Swift (iOS/macOS)
\`\`\`swift
// Swift Package Manager
.package(url: "https://github.com/hyodotdev/openiap.git", from: "${versions.apple}")

// CocoaPods
pod 'openiap', '~> ${versions.apple}'
\`\`\`

### Kotlin (Android)
\`\`\`kotlin
// Gradle (build.gradle.kts)
implementation("io.github.hyochan.openiap:openiap-google:${versions.google}")

// For Meta Horizon OS
implementation("io.github.hyochan.openiap:openiap-google-horizon:${versions.google}")

// For Fire OS (Amazon Appstore)
implementation("io.github.hyochan.openiap:openiap-google-amazon:${versions.google}")
\`\`\`

### Flutter
\`\`\`bash
flutter pub add flutter_inapp_purchase
\`\`\`

### Godot
Download \`godot-iap-${versions.godot}.zip\` from GitHub Releases, extract it to
\`addons/godot-iap/\`, then enable the plugin in Project Settings.

### Kotlin Multiplatform
\`\`\`kotlin
dependencies {
    implementation("io.github.hyochan:kmp-iap:${versions.kmp}")
}
\`\`\`

Use the latest version from Maven Central:
https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap

### .NET MAUI
\`\`\`bash
dotnet add package ${versions.mauiPackageId}
\`\`\`

Current NuGet package version: ${versions.maui}

Requires .NET 9 or .NET 10, the MAUI workload, iOS 15.0+, and Android API 24+.

---

## Framework SDK Implementations

### react-native-iap
- Package: \`react-native-iap\` on npm.
- Implementation: Nitro Modules wrapper over \`packages/apple\` and
  \`packages/google\`.
- Public surface: generated OpenIAP types plus \`useIAP\`, listener helpers,
  and platform-suffixed iOS/Android APIs.
- Android builds can select Play, Horizon, or Fire OS artifacts.
  Vega OS resolves a \`kepler\` JavaScript adapter before creating the Nitro
  HybridObject.
- Example app: \`libraries/react-native-iap/example\`.

### expo-iap
- Package: \`expo-iap\` on npm.
- Implementation: Expo Modules wrapper over the same native OpenIAP packages.
- Public surface: same hook, listener, query, mutation, and platform API
  shape as \`react-native-iap\`, adapted for Expo managed/bare workflows.
- Config plugins can select Horizon or Fire OS Android flavors;
  Vega OS follows the Onside-style runtime selector pattern with a JavaScript
  adapter.
- Example app: \`libraries/expo-iap/example\`.

### flutter_inapp_purchase
- Package: \`flutter_inapp_purchase\` on pub.dev.
- Implementation: Dart API plus generated \`types.dart\`, bridged to native
  iOS and Android method channels.
- Public surface: singleton \`FlutterInappPurchase.instance\`, typed
  \`fetchProducts<T>\`, purchase streams, and resolver-style methods.
- Android builds can select Play, Horizon, or Fire OS flavors.

### godot-iap
- Package: \`godot-iap\` for Godot 4.x.
- Implementation: GDScript API with generated \`types.gd\`, plus native iOS
  GDExtension and Android AAR plugin.
- Public surface: snake_case functions and Godot signals matching OpenIAP.

### kmp-iap
- Package: \`io.github.hyochan:kmp-iap\`.
- Implementation: Kotlin Multiplatform common API with Flow-based events,
  Android implementation, and iOS cinterop through the OpenIAP ObjC facade.
- Public surface: \`KmpIAP\` / shared instance resolver methods and flows.

### maui-iap
- Package: \`${versions.mauiPackageId}\` on NuGet.
- Distribution: single public NuGet package. The Android/iOS binding projects
  are private implementation details and are flattened into \`OpenIap.Maui\`
  instead of being published as separate package dependencies.
- Implementation: .NET MAUI projection with generated \`Types.cs\`, a static
  \`OpenIapClient.Instance\` facade, legacy \`Iap\` shim, \`IOpenIap\`
  observables, and per-platform resolvers.
- iOS/macCatalyst bridge: .NET-for-iOS binding over
  \`OpenIAP.xcframework\` and \`OpenIapModule+ObjC.swift\`; NuGet consumers get
  the official \`OpenIap.Maui.Bindings.iOS.resources.zip\` sidecar so no
  app-level \`NativeReference\` is required.
- Android bridge: Xamarin.Android binding over the MAUI-owned
  \`openiap-release.aar\`, which wraps the unbound
  \`openiap-play-release.aar\` runtime dependency. Google Billing, Play
  Services, Gson, AndroidX, and Kotlin Android libraries stay as NuGet
  \`PackageReference\` dependencies so consuming apps can deduplicate them.
- Public surface: \`QueryResolver\`, \`MutationResolver\`, and \`IOpenIap\`
  implemented by \`OpenIapIOS\`, \`OpenIapAndroid\`, and \`OpenIapMacCatalyst\`;
  IAPKit helpers mirror the TypeScript SDKs via
  \`OpenIapClient.KitApi(...)\`, \`OpenIapClient.ConnectWebhookStream(...)\`,
  \`OpenIapClient.ParseWebhookEventData(...)\`, and
  \`OpenIapClient.WebhookEventTypes\`.
- Example app: \`libraries/maui-iap/example/OpenIap.Maui.Example\`, mirroring
  the \`expo-iap\` example flows.

---

## Store Targets

- Google Play: default Android artifact, \`openiap-google\`.
- Meta Horizon: Android \`horizon\` flavor, \`openiap-google-horizon\`.
- Fire OS: Android \`amazon\` flavor,
  \`openiap-google-amazon\`; set \`fireOsEnabled=true\` or
  \`missingDimensionStrategy("platform", "amazon")\`.
  Runtime adapters are wired for native Android, \`react-native-iap\`,
  \`expo-iap\`, and \`flutter_inapp_purchase\`; Godot, KMP, and MAUI have schema
  type parity but still need Android wrapper flavor switches.
- Vega OS: not an Android flavor. Target React Native for Vega / Expo only,
  using Amazon's JavaScript IAP API through the runtime-selected \`kepler\`
  adapter at the same runtime integration layer as Onside. In Expo or React
  Native config plugin options, \`modules.vega=true\` is only a
  runtime-support guard; it does not select an Android flavor and cannot be
  combined with \`modules.fireOS\` or \`modules.horizon\`.

### Fire OS

Fire OS is an Android target for Amazon Appstore distribution. It uses the
\`amazon\` Gradle flavor and Amazon Appstore SDK.

Fire OS maps OpenIAP calls to the Amazon Appstore SDK:

| OpenIAP API | Amazon Appstore SDK mapping |
|-------------|--------------------------|
| \`initConnection()\` | Register \`PurchasingListener\`, request user data |
| \`fetchProducts()\` | \`PurchasingService.getProductData\` |
| \`requestPurchase()\` | \`PurchasingService.purchase\` |
| \`getAvailablePurchases()\` | \`PurchasingService.getPurchaseUpdates(reset=true)\` |
| \`finishTransaction()\` | \`PurchasingService.notifyFulfillment(..., FULFILLED)\` |

### Vega OS Runtime

Vega OS is not Fire OS and must not set \`fireOsEnabled=true\`; that flag is
only for Android Fire OS builds. Install
\`@amazon-devices/keplerscript-appstore-iap-lib\` and let
\`react-native-iap\` / \`expo-iap\` select the \`kepler\` adapter at runtime,
similar to how Onside is selected at the runtime integration layer.

---

## Minimal Usage by Framework

### React Native / Expo
\`\`\`typescript
import { useIAP } from 'expo-iap'; // or 'react-native-iap'

const { connected, fetchProducts, requestPurchase, finishTransaction } = useIAP({
  onPurchaseSuccess: async (purchase) => {
    await finishTransaction({ purchase, isConsumable: true });
  },
});

await fetchProducts({ skus: ['premium'], type: 'in-app' });
await requestPurchase({
  request: { ios: { sku: 'premium' }, android: { skus: ['premium'] } },
  type: 'in-app',
});
\`\`\`

### Flutter
\`\`\`dart
final iap = FlutterInappPurchase.instance;
await iap.initConnection();
final products = await iap.fetchProducts<Product>(
  skus: ['premium'],
  type: ProductQueryType.inApp,
);
iap.purchaseUpdated.listen((purchase) async {
  await iap.finishTransaction(purchase, isConsumable: true);
});
\`\`\`

### Godot
\`\`\`gdscript
GodotIapPlugin.purchase_updated.connect(_on_purchase_updated)
GodotIapPlugin.init_connection()
GodotIapPlugin.fetch_products(request)
GodotIapPlugin.request_purchase(props)
\`\`\`

### Kotlin Multiplatform
\`\`\`kotlin
val iap = KmpIAP()
iap.initConnection()
val products = iap.fetchProducts(skus = listOf("premium"))
iap.purchaseUpdatedListener.collect { purchase ->
    iap.finishTransaction(purchase = purchase, isConsumable = true)
}
\`\`\`

### .NET MAUI
\`\`\`csharp
using OpenIap;
using OpenIap.Maui;

var iap = OpenIapClient.Instance;
await ((MutationResolver)iap).InitConnectionAsync();

await ((QueryResolver)iap).FetchProductsAsync(new ProductRequest
{
    Skus = ["premium"],
    Type = ProductQueryType.InApp,
});

((IOpenIap)iap).PurchaseUpdated.Subscribe(async purchase =>
{
    await ((MutationResolver)iap).FinishTransactionAsync(
        new PurchaseInput(purchase),
        isConsumable: true
    );
});
\`\`\`

---

`;

  // Add each external file content
  for (const filePath of externalFiles.sort()) {
    const content = fs.readFileSync(filePath, "utf-8");
    const filename = path.basename(filePath, ".md");
    console.log(chalk.cyan(`  📖 Adding ${filename} to llms-full.txt`));
    fullContent += content;
    fullContent += "\n\n---\n\n";
  }

  // Add links section
  fullContent += `## Links & Resources

- Documentation: https://openiap.dev/docs
- Types Reference: https://openiap.dev/docs/types
- APIs Reference: https://openiap.dev/docs/apis
- Error Codes: https://openiap.dev/docs/errors
- GitHub: https://github.com/hyodotdev/openiap

### Ecosystem Libraries
- expo-iap: https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap
- react-native-iap: https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap
- flutter_inapp_purchase: https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase
- godot-iap: https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap
- kmp-iap: https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap
- maui-iap: https://github.com/hyodotdev/openiap/tree/main/libraries/maui-iap
`;

  // Generate llms.txt (quick reference - condensed version)
  const quickContent = `# OpenIAP Quick Reference

> OpenIAP: Unified in-app purchase specification for iOS & Android
> Documentation: https://openiap.dev
> Full Reference: https://openiap.dev/llms-full.txt
> Generated: ${generatedAt}

## Installation

### React Native / Expo
\`\`\`bash
# expo-iap (Expo projects)
npx expo install expo-iap

# react-native-iap (React Native CLI)
npm install react-native-iap
\`\`\`

### Native
\`\`\`swift
// Swift Package Manager
.package(url: "https://github.com/hyodotdev/openiap.git", from: "${versions.apple}")
\`\`\`

\`\`\`kotlin
// Gradle
implementation("io.github.hyochan.openiap:openiap-google:${versions.google}")
implementation("io.github.hyochan.openiap:openiap-google-horizon:${versions.google}")
implementation("io.github.hyochan.openiap:openiap-google-amazon:${versions.google}")
\`\`\`

\`\`\`bash
# Flutter
flutter pub add flutter_inapp_purchase
\`\`\`

\`\`\`gdscript
# Godot
# Install godot-iap ${versions.godot} to addons/godot-iap and enable the plugin
\`\`\`

\`\`\`kotlin
// Kotlin Multiplatform
implementation("io.github.hyochan:kmp-iap:${versions.kmp}")
\`\`\`

\`\`\`xml
<!-- .NET MAUI -->
<PackageReference Include="${versions.mauiPackageId}" Version="${versions.maui}" />
\`\`\`

Current NuGet package version: ${versions.maui}

## Framework Libraries

- \`expo-iap\`: Expo Modules wrapper, same OpenIAP API as React Native.
- \`react-native-iap\`: Nitro Modules wrapper for React Native CLI apps.
- \`flutter_inapp_purchase\`: Dart API with generated OpenIAP types and streams.
- \`godot-iap\`: Godot 4.x plugin with GDScript functions and signals.
- \`kmp-iap\`: Kotlin Multiplatform API with Flow-based purchase events.
- \`maui-iap\`: \`OpenIap.Maui\` package with \`OpenIapClient.Instance\`,
  generated \`Types.cs\`, IAPKit helpers (\`OpenIapClient.KitApi\`,
  \`OpenIapClient.ConnectWebhookStream\`,
  \`OpenIapClient.ParseWebhookEventData\`), flattened OpenIAP-owned iOS
  xcframework / Android AAR bindings, Google and AndroidX Android
  dependencies as NuGet package references, and MAUI example flows matching
  \`expo-iap\`.

## Core APIs

### Connection
\`\`\`typescript
// Initialize (required before any operation)
await initConnection();

// With alternative billing (Android)
await initConnection({ alternativeBillingModeAndroid: 'user-choice' });

// Cleanup on unmount
await endConnection();
\`\`\`

### Fetch Products
\`\`\`typescript
const products = await fetchProducts({
  products: [
    { id: 'com.app.premium', type: 'in-app' },
    { id: 'com.app.monthly', type: 'subs' },
  ],
});
\`\`\`

### Request Purchase
\`\`\`typescript
// IMPORTANT: requestPurchase is event-based, not promise-based
// Set up purchaseUpdatedListener before calling
await requestPurchase({
  request: {
    apple: { sku: 'com.app.premium' },
    google: { skus: ['com.app.premium'] },
  },
  type: 'in-app', // 'in-app' | 'subs'
});
\`\`\`

### Finish Transaction
\`\`\`typescript
// CRITICAL: Must call after verification
// Android: purchases auto-refund after 3 days if not acknowledged
await finishTransaction({ purchase, isConsumable });
\`\`\`

### Get Available Purchases
\`\`\`typescript
const purchases = await getAvailablePurchases();
// Returns user's current entitlements
\`\`\`

### Restore Purchases
\`\`\`typescript
await restorePurchases();
const purchases = await getAvailablePurchases();
\`\`\`

## Events (React Native/Expo)

\`\`\`typescript
import { purchaseUpdatedListener, purchaseErrorListener } from 'expo-iap';

// Set up before any purchase request
const purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
  // 1. Verify purchase on server
  // 2. Grant entitlement
  // 3. Finish transaction
  await finishTransaction({ purchase, isConsumable: false });
});

const purchaseErrorSubscription = purchaseErrorListener((error) => {
  if (error.code === 'UserCancelled') return; // Normal flow
  console.error('Purchase error:', error.message);
});

// Cleanup
purchaseUpdateSubscription.remove();
purchaseErrorSubscription.remove();
\`\`\`

## Core Types

### Product
\`\`\`typescript
interface Product {
  id: string;           // Product identifier (SKU)
  title: string;        // Display name
  description: string;  // Product description
  price: string;        // Formatted price string
  priceAmount: number;  // Price as number
  currency: string;     // ISO 4217 currency code
  type: 'in-app' | 'subs';
}
\`\`\`

### Purchase
\`\`\`typescript
interface Purchase {
  productId: string;         // Purchased product ID
  transactionId: string;     // Platform transaction ID
  transactionDate: number;   // Purchase timestamp
  purchaseState: PurchaseState;
  // iOS specific
  originalTransactionId?: string;
  // Android specific
  purchaseToken?: string;
  orderId?: string;
}

type PurchaseState = 'purchased' | 'pending' | 'restored';
\`\`\`

### PurchaseError
\`\`\`typescript
interface PurchaseError {
  code: string;       // Error code
  message: string;    // Human-readable message
  productId?: string; // Related SKU
}
\`\`\`

## Common Error Codes

| Code | Description | Action |
|------|-------------|--------|
| UserCancelled | User cancelled purchase | No action needed |
| ItemUnavailable | Product not in store | Check store config |
| AlreadyOwned | Already purchased | Restore purchases |
| NetworkError | Network issue | Retry with backoff |
| ServiceError | Store service error | Retry later |
| NotPrepared | initConnection not called | Call initConnection first |

## API Naming Convention

- **Cross-platform**: No suffix (fetchProducts, requestPurchase)
- **iOS-only**: \`IOS\` suffix (syncIOS, getStorefrontIOS)
- **Android-only**: \`Android\` suffix (acknowledgePurchaseAndroid)

## Platform-Specific APIs

### iOS
- syncIOS() - Sync with App Store
- presentCodeRedemptionSheetIOS() - Show offer code UI
- showManageSubscriptionsIOS() - Open subscription management
- beginRefundRequestIOS() - Start refund flow

### Android
- acknowledgePurchaseAndroid() - Acknowledge purchase
- consumePurchaseAndroid() - Consume for re-purchase

## Purchase Flow Summary

1. initConnection()
2. fetchProducts([...skus])
3. Set up purchaseUpdatedListener
4. requestPurchase({ sku })
5. In listener: verify -> grant -> finishTransaction()
6. endConnection() on cleanup

## Links

- Docs: https://openiap.dev/docs
- Types: https://openiap.dev/docs/types
- APIs: https://openiap.dev/docs/apis
- Errors: https://openiap.dev/docs/errors
- GitHub: https://github.com/hyodotdev/openiap
`;

  // The website serves packages/docs/public. Root files are symlinks to avoid
  // drift between local repository readers and deployed docs.
  fs.mkdirSync(CONFIG.llmsOutputDir, { recursive: true });
  fs.writeFileSync(
    path.join(CONFIG.llmsOutputDir, "llms.txt"),
    withFinalNewline(quickContent),
  );
  fs.writeFileSync(
    path.join(CONFIG.llmsOutputDir, "llms-full.txt"),
    withFinalNewline(fullContent),
  );
  for (const [filename, targetPath] of Object.entries(CONFIG.rootLlmsSymlinks)) {
    ensureSymlink(path.join(CONFIG.projectRoot, filename), targetPath);
  }

  console.log(
    chalk.green(`  ✓ llms.txt: ${(quickContent.length / 1024).toFixed(1)} KB`),
  );
  console.log(
    chalk.green(
      `  ✓ llms-full.txt: ${(fullContent.length / 1024).toFixed(1)} KB`,
    ),
  );

  return { quick: quickContent.length, full: fullContent.length };
}

// ============================================================================
// Main Function
// ============================================================================

async function compileContext(): Promise<void> {
  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("📝 Claude Code Context Compiler"));
  console.log(chalk.bold.cyan("═".repeat(60)));
  console.log(chalk.gray(`\nKnowledge Root: ${CONFIG.knowledgeRoot}`));

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  let output = `# OpenIAP Project Context

> **Auto-generated for Claude Code**
> Last updated: ${new Date().toISOString()}
>
> Usage: \`claude --context knowledge/_claude-context/context.md\`

---

`;

  // =========================================================================
  // INTERNAL RULES (HIGHEST PRIORITY)
  // =========================================================================

  console.log(chalk.blue("\n📚 Processing Internal Rules...\n"));

  output += `# 🚨 INTERNAL RULES (MANDATORY)

These rules define OpenIAP's development philosophy.
**You MUST follow these rules EXACTLY. No exceptions.**

---

`;

  const internalFiles = await glob(
    path.join(CONFIG.knowledgeRoot, "internal/**/*.md"),
    { absolute: true },
  );

  for (const filePath of internalFiles.sort()) {
    const content = fs.readFileSync(filePath, "utf-8");
    const relativePath = path.relative(CONFIG.knowledgeRoot, filePath);

    console.log(chalk.magenta(`  📜 ${relativePath}`));

    output += `<!-- Source: ${relativePath} -->\n\n`;
    output += content;
    output += "\n\n---\n\n";
  }

  console.log(
    chalk.green(`  ✓ ${internalFiles.length} internal files processed`),
  );

  // =========================================================================
  // EXTERNAL API DOCS (REFERENCE)
  // =========================================================================

  console.log(chalk.blue("\n📖 Processing External Docs...\n"));

  output += `# 📚 EXTERNAL API REFERENCE

Use this documentation for API details, but **ALWAYS adapt patterns to match Internal Rules above**.

---

`;

  const externalFiles = await glob(
    path.join(CONFIG.knowledgeRoot, "external/**/*.md"),
    { absolute: true },
  );

  for (const filePath of externalFiles.sort()) {
    const content = fs.readFileSync(filePath, "utf-8");
    const relativePath = path.relative(CONFIG.knowledgeRoot, filePath);

    console.log(chalk.cyan(`  📖 ${relativePath}`));

    output += `<!-- Source: ${relativePath} -->\n\n`;
    output += content;
    output += "\n\n---\n\n";
  }

  console.log(
    chalk.green(`  ✓ ${externalFiles.length} external files processed`),
  );

  // =========================================================================
  // PROJECT STRUCTURE
  // =========================================================================

  output += `# 📁 PROJECT STRUCTURE

\`\`\`
openiap/
├── packages/
│   ├── apple/        # iOS/macOS StoreKit 2 (Swift)
│   │   └── Sources/
│   │       ├── Models/      # Official types
│   │       ├── Helpers/     # Internal helpers
│   │       └── OpenIapModule.swift
│   ├── google/       # Android Play Billing (Kotlin)
│   │   └── openiap/src/main/
│   │       ├── java/dev/hyo/openiap/
│   │       └── Types.kt     # AUTO-GENERATED
│   ├── gql/          # GraphQL schema & type generation
│   └── docs/         # Documentation site
├── knowledge/        # Shared knowledge base
│   ├── internal/     # Project philosophy
│   └── external/     # External API reference
└── scripts/agent/    # RAG agent scripts
\`\`\`

## Key Reminders

- **packages/apple**: iOS functions MUST end with \`IOS\` suffix
- **packages/google**: DO NOT add \`Android\` suffix (it's Android-only package)
- **packages/gql**: Types.kt and Types.swift are AUTO-GENERATED, never edit directly
- **Cross-platform functions**: NO platform suffix

`;

  // =========================================================================
  // Write Output
  // =========================================================================

  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  fs.writeFileSync(outputPath, withFinalNewline(output));

  // =========================================================================
  // Generate LLMs.txt Files
  // =========================================================================

  const llmsStats = await generateLlmsTxt();

  // =========================================================================
  // Summary
  // =========================================================================

  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("📊 Compilation Summary"));
  console.log(chalk.bold.cyan("═".repeat(60)));
  console.log(chalk.magenta(`  Internal Rules: ${internalFiles.length} files`));
  console.log(chalk.cyan(`  External Docs:  ${externalFiles.length} files`));
  console.log(
    chalk.white(`  context.md:     ${(output.length / 1024).toFixed(1)} KB`),
  );
  console.log(
    chalk.white(`  llms.txt:       ${(llmsStats.quick / 1024).toFixed(1)} KB`),
  );
  console.log(
    chalk.white(`  llms-full.txt:  ${(llmsStats.full / 1024).toFixed(1)} KB`),
  );
  console.log(chalk.green(`\n  ✓ Output: ${outputPath}`));
  console.log(
    chalk.green(`  ✓ Output: ${path.join(CONFIG.llmsOutputDir, "llms.txt")}`),
  );
  console.log(
    chalk.green(
      `  ✓ Output: ${path.join(CONFIG.llmsOutputDir, "llms-full.txt")}`,
    ),
  );
  for (const [filename, targetPath] of Object.entries(CONFIG.rootLlmsSymlinks)) {
    console.log(chalk.green(`  ✓ Symlink: ${filename} -> ${targetPath}`));
  }

  console.log(chalk.bold.green("\n✅ Context compilation complete!\n"));
  console.log(chalk.white("Usage with Claude Code:"));
  console.log(
    chalk.gray(
      `  claude --context ${path.relative(CONFIG.projectRoot, outputPath)}\n`,
    ),
  );
  console.log(chalk.white("Or in an existing session:"));
  console.log(
    chalk.gray(
      `  /context add ${path.relative(CONFIG.projectRoot, outputPath)}\n`,
    ),
  );
}

// ============================================================================
// Entry Point
// ============================================================================

compileContext().catch((error) => {
  console.error(chalk.red("\n❌ Compilation failed:"), error);
  process.exit(1);
});
