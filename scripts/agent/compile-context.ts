/**
 * Shared Agent Context Compiler (No Ollama Required)
 *
 * This script compiles all knowledge files into a single context.md file
 * that can be loaded by any AI assistant.
 *
 * Usage:
 *   bun run compile
 *
 * Output:
 *   knowledge/_agent-context/context.md
 *
 * Repository-aware assistants discover project rules through AGENTS.md and
 * the CLAUDE.md / GEMINI.md compatibility symlinks. This compiled file is a
 * shared reference for audits, local RAG, and on-demand reading.
 */

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import chalk from "chalk";
import {
  CONTEXT_COMPATIBILITY_SYMLINKS,
  CONTEXT_OUTPUTS,
  CONTEXT_SOURCES,
  ROOT_LLMS_SYMLINKS,
} from "./context-files.js";

// ============================================================================
// Configuration
// ============================================================================

// Use script directory instead of process.cwd() for stable path resolution
// Note: import.meta.dir is Bun-specific, use fileURLToPath for Node.js compatibility
import { fileURLToPath } from "url";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  projectRoot: path.resolve(scriptDir, "../.."),
  knowledgeRoot: path.resolve(
    scriptDir,
    "../..",
    CONTEXT_SOURCES.knowledgeRoot,
  ),
  outputPath: path.resolve(scriptDir, "../..", CONTEXT_OUTPUTS.context),
  // LLMs.txt output (for AI assistants on web)
  llmsQuickPath: path.resolve(scriptDir, "../..", CONTEXT_OUTPUTS.llmsQuick),
  llmsFullPath: path.resolve(scriptDir, "../..", CONTEXT_OUTPUTS.llmsFull),
  rootLlmsSymlinks: ROOT_LLMS_SYMLINKS,
  compatibilitySymlinks: CONTEXT_COMPATIBILITY_SYMLINKS,
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
    CONTEXT_SOURCES.openiapVersions,
  );

  return {
    apple: openiapVersions.apple,
    google: openiapVersions.google,
    flutter: readRegexVersion(
      CONTEXT_SOURCES.flutterPackage,
      /^version:\s*([^\s]+)/m,
      "flutter_inapp_purchase",
    ),
    godot: readRegexVersion(
      CONTEXT_SOURCES.godotPackage,
      /^version="([^"]+)"$/m,
      "godot-iap",
    ),
    kmp: readRegexVersion(
      CONTEXT_SOURCES.kmpPackage,
      /^libraryVersion=(.+)$/m,
      "kmp-iap",
    ),
    maui: readRegexVersion(
      CONTEXT_SOURCES.mauiPackage,
      /<PackageVersion>([^<]+)<\/PackageVersion>/,
      "OpenIap.Maui",
    ),
    mauiPackageId: readRegexVersion(
      CONTEXT_SOURCES.mauiPackage,
      /<PackageId>([^<]+)<\/PackageId>/,
      "OpenIap.Maui package id",
    ),
  };
}

function withFinalNewline(content: string): string {
  return `${content.trimEnd()}\n`;
}

export function normalizeGeneratedTimestamps(content: string): string {
  return content.replace(
    /^(> (?:Last updated|Generated): ).+$/gm,
    "$1<TIMESTAMP>",
  );
}

export function writeGeneratedFileIfChanged(
  filePath: string,
  content: string,
  ignoreTimestampOnlyChanges = true,
): boolean {
  const finalizedContent = withFinalNewline(content);
  if (fs.existsSync(filePath)) {
    const existingContent = fs.readFileSync(filePath, "utf-8");
    const comparableExisting = ignoreTimestampOnlyChanges
      ? normalizeGeneratedTimestamps(existingContent)
      : existingContent;
    const comparableGenerated = ignoreTimestampOnlyChanges
      ? normalizeGeneratedTimestamps(finalizedContent)
      : finalizedContent;
    if (comparableExisting === comparableGenerated) {
      return false;
    }
  }

  fs.writeFileSync(filePath, finalizedContent);
  return true;
}

type GeneratedOutput = {
  content: string;
  filePath: string;
};

export function alignGeneratedOutputTimestamps(
  outputs: GeneratedOutput[],
): GeneratedOutput[] {
  const semanticContentIsUnchanged = outputs.every(({ content, filePath }) => {
    if (!fs.existsSync(filePath)) return false;
    return (
      normalizeGeneratedTimestamps(fs.readFileSync(filePath, "utf-8")) ===
      normalizeGeneratedTimestamps(withFinalNewline(content))
    );
  });
  if (!semanticContentIsUnchanged) return outputs;

  const existingTimestamps = outputs
    .map(({ filePath }) =>
      fs
        .readFileSync(filePath, "utf-8")
        .match(/^> Generated: (.+)$/m)?.[1]
        ?.trim(),
    )
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort();
  const sharedTimestamp = existingTimestamps.at(-1);
  if (!sharedTimestamp) return outputs;

  return outputs.map(({ content, filePath }) => ({
    filePath,
    content: content.replace(/^(> Generated: ).+$/m, `$1${sharedTimestamp}`),
  }));
}

export function ensureSymlink(linkPath: string, targetPath: string): void {
  let currentStats: fs.Stats | undefined;

  try {
    currentStats = fs.lstatSync(linkPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  if (currentStats?.isSymbolicLink()) {
    const currentTarget = fs.readlinkSync(linkPath);
    if (currentTarget === targetPath) {
      return;
    }
    fs.unlinkSync(linkPath);
  } else if (currentStats?.isDirectory()) {
    const entries = fs.readdirSync(linkPath);
    const legacyContextPath = path.join(linkPath, "context.md");
    const hasOnlyGeneratedContext =
      entries.every((entry) => entry === "context.md") &&
      (!fs.existsSync(legacyContextPath) ||
        fs.lstatSync(legacyContextPath).isFile());

    if (!hasOnlyGeneratedContext) {
      throw new Error(
        `Cannot replace ${linkPath}: legacy directory contains non-generated files`,
      );
    }

    fs.rmSync(linkPath, { recursive: true });
  } else if (currentStats) {
    fs.unlinkSync(linkPath);
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
  const deprecationMigrationReference = `## Deprecations and major-version migration

- OpenIAP 3.0, \`react-native-iap\` 16.0.0, \`expo-iap\` 5.0.0,
  \`flutter_inapp_purchase\` 10.0.0, \`godot-iap\` 3.0.0,
  \`kmp-iap\` 3.0.0, and \`OpenIap.Maui\` 2.0.0 expose only the canonical
  OpenIAP-owned contract.
- Generated declarations and handwritten wrappers contain no member from the
  completed removal catalog. Raw JavaScript, Expo config, Flutter
  MethodChannel, and Godot dictionary inputs must also use canonical keys.
- Removed aliases are rejected or ignored rather than regaining precedence
  when canonical input is absent. Historical redirects remain only to route
  documentation bookmarks to current replacements.
- StoreKit, Play Billing, Amazon, Horizon, and internal SDK transport response
  normalization are upstream compatibility, not user-authored legacy input,
  and remain until their upstream contracts permit removal.
- Future deprecations require one named future major, one canonical
  replacement, generated warnings where supported, migration documentation,
  and executable absence checks at the removal boundary. Patch and minor
  releases must not remove them early.
- See https://openiap.dev/docs/updates/migration for the complete mapping.
`;

  // Read all external API docs
  const externalFiles = await glob(
    path.join(CONFIG.projectRoot, CONTEXT_SOURCES.externalKnowledgeGlob),
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
8. OpenIAP Commerce Protocol

## Documentation boundary

This reference documents the OpenIAP client contract and the vendor-neutral
OpenIAP Commerce Protocol. IAPKit is one conforming implementation; its product
setup, hosted API, compatibility, operations, MCP, and AI reference live at
https://kit.openiap.dev/docs and https://kit.openiap.dev/llms.txt.

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
- Android builds select Play, Horizon, or Fire OS with Gradle properties
  (\`horizonEnabled\`, \`fireOsEnabled\`). Vega OS uses a separate React Native
  for Vega target that resolves the \`kepler\` JavaScript adapter before
  creating the Nitro HybridObject.
- Onside is not supported in \`react-native-iap\`; use \`expo-iap\` for Onside.
- Example app: \`libraries/react-native-iap/example\`.

### expo-iap
- Package: \`expo-iap\` on npm.
- Implementation: Expo Modules wrapper over the same native OpenIAP packages.
- Public surface: same hook, listener, query, mutation, and platform API
  shape as \`react-native-iap\`, adapted for Expo managed/bare workflows.
- Config plugins can select Horizon, Fire OS, Vega OS, and Onside:
  \`modules.horizon\` + \`android.horizon.appId\`,
  \`modules.amazon.fireOS\`, \`modules.amazon.vegaOS\`, optional
  \`android.amazon.vegaOS\` metadata, and \`modules.onside\`.
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
  \`OpenIapClient.Instance\` facade, \`IOpenIap\` observables, and per-platform
  resolvers.
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
  app-facing IAPKit helpers mirror the TypeScript SDKs via
  \`OpenIapClient.KitApi(...)\`.
- Example app: \`libraries/maui-iap/example/OpenIap.Maui.Example\`, mirroring
  the \`expo-iap\` example flows.

---

## Store Setup

Canonical setup docs live under \`/docs/setup/store\`:
\`/docs/setup/store/horizon\`, \`/docs/setup/store/amazon\`, and
\`/docs/setup/store/onside\`. Deprecated feature URLs redirect there.

- Google Play: default Android artifact, \`openiap-google\`.
- Meta Horizon: Android \`horizon\` flavor, \`openiap-google-horizon\`.
  Expo uses \`modules.horizon=true\` and \`android.horizon.appId\`.
  React Native and Flutter use \`horizonEnabled=true\` plus app-owned manifest
  metadata. KMP exposes \`horizonRelease\`. MAUI uses
  \`OpenIapAndroidStore=horizon\`. Godot has no dedicated Horizon selector.
  Required values: Horizon app id from Meta Horizon Developer Hub
  (Expo: \`android.horizon.appId\`; bare RN/Flutter examples commonly pass a
  Gradle property named \`horizonAppId\` into manifest meta-data), product SKUs,
  and verification
  values such as \`horizon.sku\`, \`horizon.userId\`, and
  \`horizon.accessToken\` when validating Horizon purchases.
- Fire OS: Android \`amazon\` flavor,
  \`openiap-google-amazon\`; use \`modules.amazon.fireOS=true\`
  in the Expo config plugin, or
  \`missingDimensionStrategy("platform", "amazon")\` in bare Android /
  React Native / Flutter app Gradle config.
  Runtime adapters are wired for native Android, \`react-native-iap\`,
  \`expo-iap\`, \`flutter_inapp_purchase\`, KMP \`amazonRelease\`, and MAUI
  \`OpenIapAndroidStore=amazon\`. Godot has shared Amazon types and
  verification payloads but no dedicated Fire OS flavor switch.
  Required values: Android \`applicationId\` matching the Amazon Developer
  Console app, Amazon Appstore product ids / App Tester catalog entries, and
  the Amazon public key for Fire OS Android builds. Receipt verification and
  sandbox configuration belong to the chosen backend; IAPKit documents its
  hosted setup at https://kit.openiap.dev/docs/verification/amazon.
- Vega OS: not an Android flavor. Target React Native for Vega and compatible
  Expo Vega targets only, using Amazon's JavaScript IAP API through the
  runtime-selected \`kepler\` adapter at the same runtime integration layer as
  Onside. In Expo config plugin options, use \`modules.amazon.vegaOS=true\`.
  Bare React Native Vega targets
  provide their own \`manifest.toml\`, Kepler package metadata, and runtime
  dependencies.
  \`modules.amazon.fireOS\` and \`modules.amazon.vegaOS\` can both be enabled
  when an app produces separate Fire OS and Vega OS artifacts.
  Required values: Vega \`manifest.toml\` package id, title, interactive
  component id, Kepler runtime/module declarations, Amazon product ids, and
  Vega runtime dependencies. In Expo, optional \`android.amazon.vegaOS\` overrides
  (\`packageId\`, \`title\`, \`appName\`, \`icon\`) default from the normal Expo
  app config unless Vega metadata must differ.
- Onside: currently \`expo-iap\` only. Enable \`modules.onside=true\` and run
  Expo prebuild so the iOS module autolinking and Podfile environment are
  regenerated. Required values: stable \`ios.bundleIdentifier\`, Onside app
  registration at developer.onside.io, and the \`modules.onside\` config flag.

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

Vega OS is not Fire OS and is not selected with \`fireOsEnabled=true\`; that
flag is only for Android Fire OS builds. Use \`modules.amazon.vegaOS=true\`
for the Vega runtime target in Expo, and \`modules.amazon.fireOS=true\` for
separate Fire OS Android artifacts in the Expo config plugin. Bare React Native
uses direct Gradle flavor selection for Fire OS and a separate Kepler target for
Vega. Install
\`@amazon-devices/keplerscript-appstore-iap-lib\` and let \`react-native-iap\`
/ \`expo-iap\` select the \`kepler\` adapter at runtime, similar to how Onside
is selected at the runtime integration layer.

---

## Minimal Usage by Framework

### React Native / Expo
\`\`\`typescript
import { useEffect } from 'react';
import { Button } from 'react-native';
import { useIAP } from 'expo-iap'; // or 'react-native-iap'

function PremiumButton() {
  const { connected, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void finishTransaction({ purchase, isConsumable: true }).catch((error) => {
        console.warn('Transaction finalization failed:', error);
      });
    },
  });

  useEffect(() => {
    if (!connected) return;
    void fetchProducts({ skus: ['premium'], type: 'in-app' }).catch((error) =>
      console.warn('Product fetch failed:', error),
    );
  }, [connected, fetchProducts]);

  return (
    <Button
      title="Buy premium"
      disabled={!connected}
      onPress={() => {
        void requestPurchase({
          request: { apple: { sku: 'premium' }, google: { skus: ['premium'] } },
          type: 'in-app',
        }).catch((error) => {
          console.warn('Purchase dispatch failed:', error);
        });
      }}
    />
  );
}
\`\`\`

### Flutter
\`\`\`dart
final iap = FlutterInappPurchase.instance;
iap.purchaseUpdatedListener.listen((purchase) {
  iap
      .finishTransaction(purchase: purchase, isConsumable: true)
      .catchError((Object error) => print('Transaction finalization failed: $error'));
});
final connected = await iap.initConnection();
if (!connected) throw StateError('Store connection failed');
final products = await iap.fetchProducts<Product>(
  skus: ['premium'],
  type: ProductQueryType.InApp,
);
\`\`\`

### Godot
\`\`\`gdscript
GodotIapPlugin.purchase_updated.connect(_on_purchase_updated)
var connected = await GodotIapPlugin.init_connection()
if not connected:
    push_error("Store connection failed")
    return
await GodotIapPlugin.fetch_products(request)
GodotIapPlugin.request_purchase(props)
\`\`\`

### Kotlin Multiplatform
\`\`\`kotlin
val iap = KmpIAP()
val purchaseJob = appScope.launch(
    start = kotlinx.coroutines.CoroutineStart.UNDISPATCHED
) {
    iap.purchaseUpdatedListener.collect { purchase ->
        iap.finishTransaction(purchase = purchase, isConsumable = true)
    }
}
val connected = iap.initConnection()
check(connected) { "Store connection failed" }
val products = iap.fetchProducts {
    skus = listOf("premium")
    type = ProductQueryType.InApp
}
// purchaseJob.cancel() at the connection owner's teardown boundary.
\`\`\`

### .NET MAUI
\`\`\`csharp
using OpenIap;
using OpenIap.Maui;

var iap = OpenIapClient.Instance;
var connected = await ((MutationResolver)iap).InitConnectionAsync();
if (!connected) throw new InvalidOperationException("Store connection failed");

await ((QueryResolver)iap).FetchProductsAsync(new ProductRequest
{
    Skus = ["premium"],
    Type = ProductQueryType.InApp,
});

async Task FinishPurchaseSafelyAsync(Purchase purchase)
{
    try
    {
        await ((MutationResolver)iap).FinishTransactionAsync(
            new PurchaseInput(purchase),
            isConsumable: true
        );
    }
    catch (Exception error)
    {
        Console.WriteLine($"Transaction finalization failed: {error.Message}");
    }
}

((IOpenIap)iap).PurchaseUpdated.Subscribe(
    purchase => _ = FinishPurchaseSafelyAsync(purchase));
\`\`\`

---

`;

  // Internal IAPKit notes remain in the compiled repository context but do not
  // belong in OpenIAP's public AI reference.
  const publicExternalFiles = externalFiles.filter(
    (filePath) => path.basename(filePath) !== "webhook-mapping.md",
  );

  // Add each public external file content
  for (const filePath of publicExternalFiles.sort()) {
    const content = fs.readFileSync(filePath, "utf-8");
    const filename = path.basename(filePath, ".md");
    console.log(chalk.cyan(`  📖 Adding ${filename} to llms-full.txt`));
    fullContent += content;
    fullContent += "\n\n---\n\n";
  }

  const commerceProtocolSpec = fs.readFileSync(
    path.join(CONFIG.projectRoot, CONTEXT_SOURCES.commerceProtocolSpec),
    "utf-8",
  );
  fullContent += commerceProtocolSpec.trimEnd();
  fullContent += "\n\n---\n\n";
  fullContent += deprecationMigrationReference.trimEnd();
  fullContent += "\n\n---\n\n";

  // Add links section
  fullContent += `## Links & Resources

- Documentation: https://openiap.dev/docs
- Types Reference: https://openiap.dev/docs/types
- APIs Reference: https://openiap.dev/docs/apis
- Error Codes: https://openiap.dev/docs/errors
- Commerce Protocol: https://openiap.dev/docs/commerce-protocol
- Commerce Protocol Webhook Contract: https://openiap.dev/docs/webhooks
- Commerce Protocol Specification: https://github.com/hyodotdev/openiap/blob/main/specs/openiap/commerce-protocol/SPEC.md
- Commerce Protocol GraphQL contract (authored layers): https://github.com/hyodotdev/openiap/tree/main/specs/openiap/commerce-protocol/schema
- Commerce Protocol Conformance Vectors: https://github.com/hyodotdev/openiap/tree/main/specs/openiap/commerce-protocol/vectors
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
  let quickContent = `# OpenIAP Quick Reference

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
  generated \`Types.cs\`, app-facing IAPKit helpers
  (\`OpenIapClient.KitApi\`), flattened OpenIAP-owned iOS
  xcframework / Android AAR bindings, Google and AndroidX Android
  dependencies as NuGet package references, and MAUI example flows matching
  \`expo-iap\`.

${deprecationMigrationReference}

## Core APIs

### Connection
\`\`\`typescript
// Choose one call: remove the config for a standard connection.
const connected = await initConnection({
  enableBillingProgramAndroid: 'user-choice-billing',
});
if (!connected) throw new Error('Store connection failed');

// Cleanup at the connection owner's teardown boundary.
const ended = await endConnection();
if (!ended) console.warn('Store teardown did not complete');
\`\`\`

### Fetch Products
\`\`\`typescript
const products = await fetchProducts({
  skus: ['com.app.premium', 'com.app.pro'],
  type: 'in-app',
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

### Redeem Offer Code
\`\`\`typescript
// Cross-platform; replaces the deprecated presentCodeRedemptionSheetIOS
// and openRedeemOfferCodeAndroid (removal in OpenIAP 4.0)
const purchase = await openRedeemOfferCode();
// Verified purchase only on Apple 27+ from Xcode 27+ builds; every other
// flow resolves null (pre-27 iOS sheet, Play redeem page, Horizon/Amazon
// no-op). Throws when a redemption flow exists but cannot be opened.
// Redeemed purchases arrive via purchaseUpdatedListener; reconcile with
// getAvailablePurchases on resume.
\`\`\`

## Events (React Native/Expo)

\`\`\`typescript
import {
  ErrorCode,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';

// Set up before any purchase request
const purchaseUpdateSubscription = purchaseUpdatedListener((purchase) => {
  // After server verification and entitlement grant, finish the transaction.
  void finishTransaction({ purchase, isConsumable: false }).catch((error) => {
    console.warn('Transaction finalization failed:', error);
  });
});

const purchaseErrorSubscription = purchaseErrorListener((error) => {
  if (error.code === ErrorCode.UserCancelled) return; // Normal flow
  console.error('Purchase error:', error.message);
});

// Cleanup
purchaseUpdateSubscription.remove();
purchaseErrorSubscription.remove();
\`\`\`

## Core Types

### Shared Product Fields
\`\`\`typescript
interface ProductCommon {
  id: string;              // Product identifier (SKU)
  title: string;           // Store title
  description: string;     // Product description
  displayPrice: string;    // Localized price
  price?: number | null;   // Numeric price when available
  currency: string;        // ISO 4217 currency code
  platform: 'android' | 'ios';
  type: 'in-app' | 'subs';
}

type Product = ProductAndroid | ProductIOS;
type ProductSubscription = ProductSubscriptionAndroid | ProductSubscriptionIOS;
\`\`\`

### Purchase
\`\`\`typescript
interface PurchaseCommon {
  id: string;
  productId: string;
  transactionDate: number;
  purchaseState: PurchaseState;
  purchaseToken?: string | null;
  quantity: number;
  isAutoRenewing: boolean;
}

type Purchase = PurchaseAndroid | PurchaseIOS;
type PurchaseState = 'pending' | 'purchased' | 'unknown';
\`\`\`

### PurchaseError
\`\`\`typescript
interface PurchaseError {
  code: ErrorCode;                                  // Generated kebab-case error enum
  message: string;                                  // Human-readable message
  productId?: string | null;                        // Related SKU when available
  debugMessage?: string | null;                     // Native diagnostic
  responseCode?: number | null;                     // Android query response code
  productIds?: string[] | null;                     // Android requested product IDs
  productType?: string | null;                      // Android product type
  isEmptyProductList?: boolean | null;              // Android query returned no products
  subResponseCodeAndroid?: SubResponseCodeAndroid | null; // Play purchase-update detail
}
\`\`\`

## Common Error Codes

| Code | Description | Action |
|------|-------------|--------|
| user-cancelled | User cancelled purchase | No action needed |
| duplicate-purchase | A purchase request is already in progress | Wait for the active request instead of starting another |
| item-unavailable | Product not in store | Check store config |
| already-owned | Already purchased | Restore purchases |
| network-error | Network issue | Retry with backoff |
| service-error | Store service error | Retry later |
| not-prepared | initConnection not called | Call initConnection first |

## API Naming Convention

- **Cross-platform**: No suffix (fetchProducts, requestPurchase)
- **iOS-only**: \`IOS\` suffix (syncIOS, getStorefrontIOS)
- **Android-only**: \`Android\` suffix (acknowledgePurchaseAndroid)

## Platform-Specific APIs

### iOS
- syncIOS() - Sync with App Store
- presentCodeRedemptionSheetIOS() - Deprecated; use openRedeemOfferCode() (removal in OpenIAP 4.0)
- showManageSubscriptionsIOS() - Open subscription management
- beginRefundRequestIOS() - Start refund flow

### Android
- acknowledgePurchaseAndroid() - Acknowledge purchase
- consumePurchaseAndroid() - Consume for re-purchase
- openRedeemOfferCodeAndroid() - Deprecated; use openRedeemOfferCode() (removal in OpenIAP 4.0)

## Purchase Flow Summary

1. Set up purchaseUpdatedListener and purchaseErrorListener
2. initConnection()
3. fetchProducts({ skus: [...], type: 'in-app' })
4. requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'in-app' })
5. In listener: verify -> grant -> finishTransaction()
6. endConnection() on cleanup

## OpenIAP Commerce Protocol

The OpenIAP Commerce Protocol is the vendor-neutral server-side contract for
normalized transactions, subscription lifecycle, entitlement decisions,
commerce events, HMAC-signed webhook delivery, idempotency, and conformance.
It is not a hosted service and requires no OpenIAP account, registry, issued
identifier, or central runtime.

- Keep transactions, subscriptions, commerce events, and entitlements distinct.
- Preserve unknown open values instead of rejecting otherwise valid events.
- Retry signed deliveries with fresh timestamps; consumers verify exact bytes
  and deduplicate any accepted copy on the stable body \`eventId\`.
- Use the bundled JSON Schemas and signature/lifecycle vectors for offline
  conformance.
- Docs: https://openiap.dev/docs/commerce-protocol
- Webhook contract: https://openiap.dev/docs/webhooks
- Normative spec: https://github.com/hyodotdev/openiap/blob/main/specs/openiap/commerce-protocol/SPEC.md
- Canonical GraphQL contract, authored layers (compiled to JSON Schema): https://github.com/hyodotdev/openiap/tree/main/specs/openiap/commerce-protocol/schema

IAPKit is one implementation. Its product documentation and AI notes live at
https://kit.openiap.dev/docs and https://kit.openiap.dev/llms.txt.

## Links

- Docs: https://openiap.dev/docs
- Types: https://openiap.dev/docs/types
- APIs: https://openiap.dev/docs/apis
- Errors: https://openiap.dev/docs/errors
- GitHub: https://github.com/hyodotdev/openiap
`;

  // The website serves packages/docs/public. Root files are symlinks to avoid
  // drift between local repository readers and deployed docs.
  fs.mkdirSync(path.dirname(CONFIG.llmsQuickPath), { recursive: true });
  const alignedOutputs = alignGeneratedOutputTimestamps([
    { content: quickContent, filePath: CONFIG.llmsQuickPath },
    { content: fullContent, filePath: CONFIG.llmsFullPath },
  ]);
  quickContent = alignedOutputs[0].content;
  fullContent = alignedOutputs[1].content;
  for (const { content, filePath } of alignedOutputs) {
    writeGeneratedFileIfChanged(filePath, content, false);
  }
  for (const [filename, targetPath] of Object.entries(
    CONFIG.rootLlmsSymlinks,
  )) {
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

export async function compileContext(): Promise<void> {
  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("📝 Shared Agent Context Compiler"));
  console.log(chalk.bold.cyan("═".repeat(60)));
  console.log(chalk.gray(`\nKnowledge Root: ${CONFIG.knowledgeRoot}`));

  // Ensure output directory exists
  if (!fs.existsSync(path.dirname(CONFIG.outputPath))) {
    fs.mkdirSync(path.dirname(CONFIG.outputPath), { recursive: true });
  }
  for (const [linkPath, targetPath] of Object.entries(
    CONFIG.compatibilitySymlinks,
  )) {
    ensureSymlink(path.join(CONFIG.projectRoot, linkPath), targetPath);
  }

  let output = `# OpenIAP Project Context

> **Auto-generated shared context for AI assistants**
> Last updated: ${new Date().toISOString()}
>
> Canonical file: \`knowledge/_agent-context/context.md\`

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
    path.join(CONFIG.projectRoot, CONTEXT_SOURCES.internalKnowledgeGlob),
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
    path.join(CONFIG.projectRoot, CONTEXT_SOURCES.externalKnowledgeGlob),
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

  const commerceProtocolSpec = fs.readFileSync(
    path.join(CONFIG.projectRoot, CONTEXT_SOURCES.commerceProtocolSpec),
    "utf-8",
  );
  output += `# OPENIAP COMMERCE PROTOCOL

The following normative specification defines the vendor-neutral server-side
commerce contract. IAPKit product and operational documentation is maintained
separately at https://kit.openiap.dev/docs.

---

${commerceProtocolSpec}

---

`;

  output += `# Key Reminders

- **packages/apple**: iOS functions MUST end with \`IOS\` suffix
- **packages/google**: DO NOT add \`Android\` suffix (it's Android-only package)
- **specs/openiap/client**: Types.kt and Types.swift are AUTO-GENERATED, never edit directly
- **Cross-platform functions**: NO platform suffix

`;

  // =========================================================================
  // Write Output
  // =========================================================================

  const outputPath = CONFIG.outputPath;
  writeGeneratedFileIfChanged(outputPath, output);

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
  console.log(chalk.green(`  ✓ Output: ${CONFIG.llmsQuickPath}`));
  console.log(chalk.green(`  ✓ Output: ${CONFIG.llmsFullPath}`));
  for (const [filename, targetPath] of Object.entries(
    CONFIG.rootLlmsSymlinks,
  )) {
    console.log(chalk.green(`  ✓ Symlink: ${filename} -> ${targetPath}`));
  }

  console.log(chalk.bold.green("\n✅ Context compilation complete!\n"));
  console.log(chalk.white("Canonical shared context:"));
  console.log(
    chalk.gray(`  ${path.relative(CONFIG.projectRoot, outputPath)}\n`),
  );
  console.log(chalk.white("Project instruction discovery:"));
  console.log(chalk.gray("  AGENTS.md (Codex and Grok)"));
  console.log(chalk.gray("  CLAUDE.md -> AGENTS.md"));
  console.log(chalk.gray("  GEMINI.md -> AGENTS.md\n"));
}

// ============================================================================
// Entry Point
// ============================================================================

if (import.meta.main) {
  compileContext().catch((error) => {
    console.error(chalk.red("\n❌ Compilation failed:"), error);
    process.exit(1);
  });
}
