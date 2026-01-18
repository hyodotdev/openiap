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
};

// ============================================================================
// LLMs.txt Generator
// ============================================================================

async function generateLlmsTxt(): Promise<{ quick: number; full: number }> {
  console.log(chalk.blue("\n🤖 Generating llms.txt files...\n"));

  // Read all external API docs
  const externalFiles = await glob(
    path.join(CONFIG.knowledgeRoot, "external/**/*.md"),
    { absolute: true }
  );

  // Combine all external docs for llms-full.txt
  let fullContent = `# OpenIAP Complete Reference

> OpenIAP: Unified in-app purchase specification for iOS & Android
> Documentation: https://openiap.dev
> Quick Reference: https://openiap.dev/llms.txt
> Generated: ${new Date().toISOString()}

## Table of Contents
1. Installation
2. Core APIs (Connection, Products, Purchase, Subscription)
3. Platform-Specific APIs (iOS, Android)
4. Types Reference
5. Error Codes & Handling
6. Implementation Patterns

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
.package(url: "https://github.com/hyodotdev/openiap.git", from: "1.0.0")

// CocoaPods
pod 'openiap', '~> 1.0.0'
\`\`\`

### Kotlin (Android)
\`\`\`kotlin
// Gradle (build.gradle.kts)
implementation("io.github.hyochan.openiap:openiap-google:1.0.0")

// For Meta Horizon OS
implementation("io.github.hyochan.openiap:openiap-google-horizon:1.0.0")
\`\`\`

### Flutter
\`\`\`yaml
# pubspec.yaml
dependencies:
  flutter_inapp_purchase: ^5.0.0
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
- expo-iap: https://github.com/hyochan/expo-iap
- react-native-iap: https://github.com/dooboolab-community/react-native-iap
- flutter_inapp_purchase: https://github.com/dooboolab-community/flutter_inapp_purchase
- godot-iap: https://github.com/hyochan/godot-iap
- kmp-iap: https://github.com/nicoseng/kmp-iap
`;

  // Generate llms.txt (quick reference - condensed version)
  const quickContent = `# OpenIAP Quick Reference

> OpenIAP: Unified in-app purchase specification for iOS & Android
> Documentation: https://openiap.dev
> Full Reference: https://openiap.dev/llms-full.txt
> Generated: ${new Date().toISOString()}

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
.package(url: "https://github.com/hyodotdev/openiap.git", from: "1.0.0")
\`\`\`

\`\`\`kotlin
// Gradle
implementation("io.github.hyochan.openiap:openiap-google:1.0.0")
\`\`\`

\`\`\`yaml
# Flutter
dependencies:
  flutter_inapp_purchase: ^5.0.0
\`\`\`

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
    { id: 'com.app.premium', type: 'inapp' },
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
  type: 'inapp', // 'inapp' | 'subs'
});
\`\`\`

### Finish Transaction
\`\`\`typescript
// CRITICAL: Must call after verification
// Android: purchases auto-refund after 3 days if not acknowledged
await finishTransaction(purchase, isConsumable);
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
  await finishTransaction(purchase);
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
  type: 'inapp' | 'subs';
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

  // Write files
  const llmsPath = path.join(CONFIG.llmsOutputDir, "llms.txt");
  const llmsFullPath = path.join(CONFIG.llmsOutputDir, "llms-full.txt");

  fs.writeFileSync(llmsPath, quickContent);
  fs.writeFileSync(llmsFullPath, fullContent);

  console.log(chalk.green(`  ✓ llms.txt: ${(quickContent.length / 1024).toFixed(1)} KB`));
  console.log(chalk.green(`  ✓ llms-full.txt: ${(fullContent.length / 1024).toFixed(1)} KB`));

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
    { absolute: true }
  );

  for (const filePath of internalFiles.sort()) {
    const content = fs.readFileSync(filePath, "utf-8");
    const relativePath = path.relative(CONFIG.knowledgeRoot, filePath);

    console.log(chalk.magenta(`  📜 ${relativePath}`));

    output += `<!-- Source: ${relativePath} -->\n\n`;
    output += content;
    output += "\n\n---\n\n";
  }

  console.log(chalk.green(`  ✓ ${internalFiles.length} internal files processed`));

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
    { absolute: true }
  );

  for (const filePath of externalFiles.sort()) {
    const content = fs.readFileSync(filePath, "utf-8");
    const relativePath = path.relative(CONFIG.knowledgeRoot, filePath);

    console.log(chalk.cyan(`  📖 ${relativePath}`));

    output += `<!-- Source: ${relativePath} -->\n\n`;
    output += content;
    output += "\n\n---\n\n";
  }

  console.log(chalk.green(`  ✓ ${externalFiles.length} external files processed`));

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
  fs.writeFileSync(outputPath, output);

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
  console.log(chalk.white(`  context.md:     ${(output.length / 1024).toFixed(1)} KB`));
  console.log(chalk.white(`  llms.txt:       ${(llmsStats.quick / 1024).toFixed(1)} KB`));
  console.log(chalk.white(`  llms-full.txt:  ${(llmsStats.full / 1024).toFixed(1)} KB`));
  console.log(chalk.green(`\n  ✓ Output: ${outputPath}`));
  console.log(chalk.green(`  ✓ Output: ${path.join(CONFIG.llmsOutputDir, "llms.txt")}`));
  console.log(chalk.green(`  ✓ Output: ${path.join(CONFIG.llmsOutputDir, "llms-full.txt")}`));

  console.log(chalk.bold.green("\n✅ Context compilation complete!\n"));
  console.log(chalk.white("Usage with Claude Code:"));
  console.log(chalk.gray(`  claude --context ${path.relative(CONFIG.projectRoot, outputPath)}\n`));
  console.log(chalk.white("Or in an existing session:"));
  console.log(chalk.gray(`  /context add ${path.relative(CONFIG.projectRoot, outputPath)}\n`));
}

// ============================================================================
// Entry Point
// ============================================================================

compileContext().catch((error) => {
  console.error(chalk.red("\n❌ Compilation failed:"), error);
  process.exit(1);
});
