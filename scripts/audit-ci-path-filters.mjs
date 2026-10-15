#!/usr/bin/env node

// Guards the path filters that gate native builds and Swift CodeQL.
// Filters are read from the workflows themselves, so there is no second copy.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

import {
  CONTEXT_INPUT_PATHS,
  CONTEXT_OUTPUT_PATHS,
} from "./agent/context-files.ts";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

const DOCS_EXCLUDE = "!**/*.md";
const KIT_CLIENT_CONTRACT_PATHS = Object.freeze([
  "specs/client/src/kit-api.ts",
  "specs/client/package.json",
]);
const KIT_RUNTIME_CONTRACT_PATH = "specs/commerce-protocol/**";

export const nativeWorkflows = Object.freeze([
  "ci-expo-iap.yml",
  "ci-flutter-inapp-purchase.yml",
  "ci-godot-iap.yml",
  "ci-kmp-iap.yml",
  "ci-maui-iap.yml",
  "ci-react-native-iap.yml",
]);

export const ciFilterJobs = Object.freeze({
  agent: ["ci:test-agent"],
  android: ["ci:test-android"],
  cli: ["ci:test-cli"],
  commerce: ["ci:test-commerce-protocol"],
  conformance: ["ci:test-conformance"],
  deps: ["ci:audit-lockfile"],
  docs: ["ci:test-docs"],
  gql: ["ci:test-gql"],
  ios: ["ci:test-ios", "ci:test-ios-compiler-boundaries"],
  parity: ["ci:audit-parity"],
  web: ["ci:web-e2e"],
});

// Filters whose jobs ran on every event before path filtering; pushes still run them.
export const pushAlwaysFilters = Object.freeze([
  "agent",
  "commerce",
  "conformance",
  "deps",
  "parity",
]);

export const unconditionalCiJobs = Object.freeze([
  "audit-release-state",
  "changes",
]);

function readWorkflow(root, name) {
  return parseYaml(
    fs.readFileSync(path.join(root, ".github/workflows", name), "utf8"),
  );
}

function dornyStep(document, jobId, stepId) {
  const step = document.jobs[jobId].steps.find((entry) => entry.id === stepId);
  return { step, filters: parseYaml(step.with.filters) };
}

// The audited vocabulary is exactly four forms, so ordered (GitHub native)
// and polarity-based (dorny some-with-excludes) evaluation coincide.
export function matchesPattern(pattern, file) {
  if (pattern === "**/*.md") {
    return file.endsWith(".md");
  }

  if (isAnyDepthName(pattern)) {
    const name = pattern.slice(3);
    return file === name || file.endsWith(`/${name}`);
  }

  if (pattern.endsWith("/**")) {
    return file.startsWith(pattern.slice(0, -2));
  }

  return file === pattern;
}

// `**/name`: a file with that exact name in any directory, the root included.
function isAnyDepthName(pattern) {
  return /^\*\*\/[^*?+[\]{}/!]+$/u.test(pattern);
}

export function matchesFilter(patterns, files) {
  const includes = patterns.filter((entry) => !entry.startsWith("!"));
  const excludes = patterns
    .filter((entry) => entry.startsWith("!"))
    .map((entry) => entry.slice(1));

  return files.some(
    (file) =>
      includes.some((pattern) => matchesPattern(pattern, file)) &&
      !excludes.some((pattern) => matchesPattern(pattern, file)),
  );
}

export function readScopes(root = repositoryRoot) {
  const codeql = readWorkflow(root, "codeql.yml");
  const ci = readWorkflow(root, "ci.yml");
  const core = dornyStep(codeql, "codeql-scope", "core");
  const wrappers = dornyStep(codeql, "codeql-scope", "wrappers");
  const changes = dornyStep(ci, "changes", "filter");
  const scopes = new Map();

  scopes.set("codeql:analyze-swift", core.filters.swift_core);

  for (const [component, patterns] of Object.entries(wrappers.filters)) {
    scopes.set(`codeql:analyze-swift-wrappers/${component}`, patterns);
  }

  for (const [name, patterns] of Object.entries(changes.filters)) {
    const jobIds = ciFilterJobs[name];

    if (!jobIds?.length) {
      throw new Error(
        `ci.yml: filter '${name}' has no entry in ciFilterJobs; map it to the jobs it gates`,
      );
    }

    for (const jobId of jobIds) {
      scopes.set(jobId, patterns);
    }
  }

  for (const name of nativeWorkflows) {
    scopes.set(name, readWorkflow(root, name).on.pull_request.paths);
  }

  return scopes;
}

export function selectJobs(files, root = repositoryRoot) {
  return [...readScopes(root)]
    .filter(([, patterns]) => matchesFilter(patterns, files))
    .map(([jobId]) => jobId)
    .sort();
}

const ALL_SWIFT_WRAPPERS = [
  "codeql:analyze-swift-wrappers/expo",
  "codeql:analyze-swift-wrappers/expo-onside",
  "codeql:analyze-swift-wrappers/flutter",
  "codeql:analyze-swift-wrappers/godot",
  "codeql:analyze-swift-wrappers/react-native",
];

export const cases = Object.freeze([
  {
    name: "apple-public-provider-conformance",
    files: ["packages/conformance/apple/Sources/ProviderConformance.swift"],
    jobs: [
      "ci:audit-parity",
      "ci:test-conformance",
      "ci:test-android",
      "ci:test-gql",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
    ],
  },
  {
    name: "apple-public-package-products",
    files: ["Package.swift"],
    jobs: [
      "ci-kmp-iap.yml",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
    ],
  },
  {
    name: "apple-core-docs-only",
    files: [
      "packages/apple/README.md",
      "packages/apple/CONVENTION.md",
      "packages/apple/CONTRIBUTING.md",
    ],
    jobs: ["ci:audit-parity"],
  },
  {
    name: "apple-core-source",
    files: ["packages/apple/Sources/OpenIapModule.swift"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
      "ci-godot-iap.yml",
      "ci-kmp-iap.yml",
      "ci-maui-iap.yml",
      "ci-react-native-iap.yml",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
    ],
  },
  {
    name: "apple-core-generated-types",
    files: ["packages/apple/Sources/Models/Types.swift"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
      "ci-godot-iap.yml",
      "ci-kmp-iap.yml",
      "ci-maui-iap.yml",
      "ci-react-native-iap.yml",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
    ],
  },
  {
    name: "apple-core-manifest",
    files: ["packages/apple/Package.swift"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
      "ci-godot-iap.yml",
      "ci-kmp-iap.yml",
      "ci-react-native-iap.yml",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
    ],
  },
  {
    // CocoaPods consumers build the local pod from this spec.
    name: "apple-core-podspec",
    files: ["packages/apple/openiap.podspec"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
      "ci-react-native-iap.yml",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
    ],
  },
  {
    name: "apple-core-build-script",
    files: ["packages/apple/scripts/build-xcframework.sh"],
    jobs: [
      "ci:audit-parity",
      "ci-maui-iap.yml",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
    ],
  },
  {
    name: "kmp-swift-bridge-source",
    files: [
      "libraries/kmp-iap/native/InAppPurchaseBridge/Sources/InAppPurchaseBridge/InAppPurchaseBridge.swift",
    ],
    jobs: [
      "ci:audit-lockfile",
      "ci:audit-parity",
      "ci-kmp-iap.yml",
      "codeql:analyze-swift",
    ],
  },
  {
    name: "kmp-docs-only",
    files: [
      "libraries/kmp-iap/AGENTS.md",
      "libraries/kmp-iap/CLAUDE.md",
      "libraries/kmp-iap/.vscode/README_IOS_DEVICE.md",
    ],
    jobs: ["ci:audit-parity"],
  },
  {
    name: "kmp-vscode-launch-script",
    files: ["libraries/kmp-iap/.vscode/run_ios.sh"],
    jobs: ["ci:audit-parity", "ci-kmp-iap.yml"],
  },
  {
    name: "react-native-docs-only",
    files: [
      "libraries/react-native-iap/AGENTS.md",
      "libraries/react-native-iap/CLAUDE.md",
      "libraries/react-native-iap/.claude/commands/commit.md",
      "libraries/react-native-iap/LICENSE.md",
      "libraries/react-native-iap/example/README.md",
    ],
    jobs: ["ci:audit-parity"],
  },
  {
    name: "react-native-swift-source",
    files: ["libraries/react-native-iap/ios/HybridRnIap.swift"],
    jobs: [
      "ci:audit-parity",
      "ci-react-native-iap.yml",
      "codeql:analyze-swift-wrappers/react-native",
    ],
  },
  {
    name: "react-native-nitro-spec",
    files: [
      "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
      "libraries/react-native-iap/nitro.json",
    ],
    jobs: [
      "ci:audit-parity",
      "ci-react-native-iap.yml",
      "codeql:analyze-swift-wrappers/react-native",
    ],
  },
  {
    name: "expo-docs-only",
    files: [
      "libraries/expo-iap/README.md",
      "libraries/expo-iap/CHANGELOG.md",
      "libraries/expo-iap/GEMINI.md",
      "libraries/expo-iap/example/README.md",
    ],
    jobs: ["ci:audit-parity"],
  },
  {
    name: "expo-swift-source",
    files: ["libraries/expo-iap/ios/ExpoIapModule.swift"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "codeql:analyze-swift-wrappers/expo",
      "codeql:analyze-swift-wrappers/expo-onside",
    ],
  },
  {
    name: "expo-onside-swift-source",
    files: ["libraries/expo-iap/ios/onside/OnsideIapModule.swift"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "codeql:analyze-swift-wrappers/expo",
      "codeql:analyze-swift-wrappers/expo-onside",
    ],
  },
  {
    name: "expo-onside-podfile-plugin",
    files: ["libraries/expo-iap/plugin/src/onsidePodfile.ts"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "codeql:analyze-swift-wrappers/expo",
      "codeql:analyze-swift-wrappers/expo-onside",
    ],
  },
  {
    name: "flutter-docs-only",
    files: [
      "libraries/flutter_inapp_purchase/CHANGELOG.md",
      "libraries/flutter_inapp_purchase/CONVENTION.md",
      "libraries/flutter_inapp_purchase/example/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md",
    ],
    jobs: ["ci:audit-parity"],
  },
  {
    name: "flutter-build-script",
    files: [
      "libraries/flutter_inapp_purchase/scripts/verify-apple-swiftpm-consumer-build.sh",
    ],
    jobs: [
      "ci:audit-parity",
      "ci-flutter-inapp-purchase.yml",
      "codeql:analyze-swift-wrappers/flutter",
    ],
  },
  {
    name: "godot-docs-only",
    files: [
      "libraries/godot-iap/.claude/guides/03-ios-plugin.md",
      "libraries/godot-iap/EXAMPLES.md",
    ],
    jobs: ["ci:audit-parity"],
  },
  {
    name: "godot-swift-source",
    files: [
      "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift",
    ],
    jobs: [
      "ci:audit-parity",
      "ci-godot-iap.yml",
      "codeql:analyze-swift-wrappers/godot",
    ],
  },
  {
    name: "godot-addon-behind-symlink",
    files: ["libraries/godot-iap/addons/godot-iap/godot_iap.gd"],
    jobs: [
      "ci:audit-parity",
      "ci-godot-iap.yml",
      "codeql:analyze-swift-wrappers/godot",
    ],
  },
  {
    name: "google-docs-only",
    files: [
      "packages/google/README.md",
      "packages/google/ALTERNATIVE_BILLING.md",
    ],
    jobs: ["ci:audit-parity"],
  },
  {
    // Every wrapper's Android build compiles the local openiap-google modules.
    name: "google-source",
    files: ["packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt"],
    jobs: ["ci:audit-parity", ...nativeWorkflows, "ci:test-android"],
  },
  {
    name: "google-core-module",
    files: ["packages/google/core/build.gradle.kts"],
    jobs: ["ci:audit-parity", ...nativeWorkflows, "ci:test-android"],
  },
  {
    // Wrappers read plugin and SDK versions from it.
    name: "google-root-build-script",
    files: ["packages/google/build.gradle.kts"],
    jobs: ["ci:audit-parity", ...nativeWorkflows, "ci:test-android"],
  },
  {
    name: "root-version-manifest",
    files: ["openiap-versions.json"],
    jobs: [
      "ci:audit-parity",
      "ci:test-agent",
      ...nativeWorkflows,
      "ci:test-android",
      "ci:test-gql",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
      ...ALL_SWIFT_WRAPPERS,
    ],
  },
  {
    // The wrappers link this file, so a change never touches their own paths.
    name: "google-store-resolver",
    files: ["packages/google/gradle/openiap-store.gradle"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
      "ci-kmp-iap.yml",
      "ci-maui-iap.yml",
      "ci-react-native-iap.yml",
      "ci:test-android",
    ],
  },
  {
    name: "libraries-versions-manifest",
    files: ["libraries-versions.jsonc"],
    jobs: [
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
      "ci-kmp-iap.yml",
      "ci-react-native-iap.yml",
      "codeql:analyze-swift-wrappers/expo",
      "codeql:analyze-swift-wrappers/expo-onside",
      "codeql:analyze-swift-wrappers/flutter",
      "codeql:analyze-swift-wrappers/react-native",
    ],
  },
  {
    name: "codeql-workflow-edit",
    files: [".github/workflows/codeql.yml"],
    jobs: [
      "ci:audit-lockfile",
      "ci:audit-parity",
      "codeql:analyze-swift",
      ...ALL_SWIFT_WRAPPERS,
    ],
  },
  {
    // Config-only: guards the `.github/codeql/**` dorny patterns, which the
    // workflow-edit case cannot catch (it matches on the workflow path alone).
    name: "codeql-config-edit",
    files: [".github/codeql/codeql-config.yml"],
    jobs: [
      "ci:audit-lockfile",
      "ci:audit-parity",
      "codeql:analyze-swift",
      ...ALL_SWIFT_WRAPPERS,
    ],
  },
  {
    name: "maui-binding-source",
    files: ["libraries/maui-iap/src/OpenIap.Maui/Types.cs"],
    jobs: ["ci:audit-parity", "ci-maui-iap.yml", "ci:test-gql"],
  },
  {
    // kit ships .md as bundled site content, so `web` keeps every markdown path.
    name: "kit-content-markdown",
    files: ["packages/kit/src/content/privacy-policy.md"],
    jobs: ["ci:audit-parity", "ci:test-commerce-protocol", "ci:web-e2e"],
  },
  {
    name: "docs-site-source",
    files: ["packages/docs/src/pages/docs/index.tsx"],
    jobs: ["ci:audit-parity", "ci:test-docs", "ci:web-e2e"],
  },
  {
    // Docs and kit import the MCP server's showcase and web modules.
    name: "mcp-server-source",
    files: ["packages/mcp-server/src/showcase.ts"],
    jobs: [
      "ci:audit-parity",
      "ci:test-commerce-protocol",
      "ci:test-docs",
      "ci:web-e2e",
    ],
  },
  {
    name: "commerce-protocol-source",
    files: ["specs/commerce-protocol/schema/05-operations.graphql"],
    // The kit server embeds the generated protocol artifacts at build time,
    // so a contract change also rebuilds and probes the web binary.
    jobs: [
      "ci:audit-parity",
      "ci:test-commerce-protocol",
      "ci:test-docs",
      "ci:web-e2e",
    ],
  },
  {
    // docs and web intentionally keep markdown; both are cheap ubuntu jobs.
    name: "docs-markdown",
    files: ["packages/docs/README.md"],
    jobs: ["ci:audit-parity", "ci:test-docs", "ci:web-e2e"],
  },
  // Inputs a test or `bun run` script reads; the step text does not name them.
  {
    name: "cli-readme-contract",
    files: ["packages/cli/README.md"],
    jobs: ["ci:audit-parity", "ci:test-cli"],
  },
  {
    name: "community-touchpoints",
    files: ["packages/docs/community-touchpoints.json"],
    jobs: [
      "ci:audit-parity",
      "ci:test-agent",
      "ci:test-cli",
      "ci:test-docs",
      "ci:web-e2e",
    ],
  },
  {
    name: "docs-audit-script",
    files: ["scripts/audit-docs.ts"],
    jobs: [
      "ci:audit-lockfile",
      "ci:audit-parity",
      "ci:test-android",
      "ci:test-gql",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "ci:test-docs",
    ],
  },
  {
    name: "generated-sync-manifest",
    files: ["specs/client/generated-sync-manifest.mjs"],
    jobs: [
      "ci:audit-parity",
      "ci-maui-iap.yml",
      "ci:test-android",
      "ci:test-gql",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "ci:test-docs",
    ],
  },
  {
    name: "generated-typescript-types",
    files: ["specs/client/src/generated/types.ts"],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "ci-maui-iap.yml",
      "ci-react-native-iap.yml",
      "ci:test-android",
      "ci:test-gql",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "ci:test-docs",
    ],
  },
  {
    name: "web-e2e-runner",
    files: ["scripts/e2e-web-sites.mjs"],
    jobs: [
      "ci:audit-lockfile",
      "ci:audit-parity",
      "ci:test-android",
      "ci:test-gql",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "ci:web-e2e",
    ],
  },
  {
    name: "commerce-evidence-audit",
    files: ["scripts/audit-commerce-evidence.mjs"],
    jobs: [
      "ci:audit-lockfile",
      "ci:audit-parity",
      "ci:test-android",
      "ci:test-gql",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "ci:web-e2e",
    ],
  },
  {
    // openiap-google's settings include it, and every wrapper but Expo's includes that.
    name: "conformance-android-module",
    files: ["packages/conformance/android/build.gradle.kts"],
    jobs: [
      "ci:audit-parity",
      "ci:test-conformance",
      "ci-flutter-inapp-purchase.yml",
      "ci-godot-iap.yml",
      "ci-kmp-iap.yml",
      "ci-maui-iap.yml",
      "ci-react-native-iap.yml",
      "ci:test-android",
      "ci:test-gql",
    ],
  },
  {
    name: "apple-compatibility-fixture",
    files: ["packages/apple/compatibility/community-provider/Package.swift"],
    jobs: [
      "ci:audit-parity",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
    ],
  },
  {
    // scripts/agent/tests read these, so they cannot ride on context-files.ts.
    name: "agent-test-inputs",
    files: [".claude/commands/review-pr.md", ".husky/pre-commit"],
    jobs: ["ci:audit-parity", "ci:test-agent"],
  },
  {
    name: "scripts-docs-only",
    files: ["scripts/agent/README.md"],
    jobs: ["ci:audit-lockfile", "ci:audit-parity", "ci:test-agent"],
  },
  {
    name: "mixed-docs-and-source",
    files: [
      "libraries/expo-iap/README.md",
      "libraries/godot-iap/ios-gdextension/Sources/GodotIap/Binder.swift",
    ],
    jobs: [
      "ci:audit-parity",
      "ci-godot-iap.yml",
      "codeql:analyze-swift-wrappers/godot",
    ],
  },
  {
    name: "mixed-two-wrappers",
    files: [
      "libraries/expo-iap/ios/ExpoIapLog.swift",
      "libraries/godot-iap/ios-gdextension/Package.swift",
    ],
    jobs: [
      "ci:audit-parity",
      "ci-expo-iap.yml",
      "ci-godot-iap.yml",
      "codeql:analyze-swift-wrappers/expo",
      "codeql:analyze-swift-wrappers/expo-onside",
      "codeql:analyze-swift-wrappers/godot",
    ],
  },
  {
    name: "pr-361-docs-replay",
    files: [
      "AGENTS.md",
      "libraries/expo-iap/AGENTS.md",
      "libraries/godot-iap/CLAUDE.md",
      "libraries/maui-iap/CONVENTION.md",
      "libraries/react-native-iap/GEMINI.md",
      "knowledge/internal/02-architecture.md",
      "packages/apple/CONTRIBUTING.md",
    ],
    jobs: ["ci:audit-parity", "ci:test-agent"],
  },
  {
    // A docs page runs the docs jobs and the parity audit's docs scan, no more.
    name: "docs-content-page",
    files: ["packages/docs/src/pages/docs/apis/fetch-products.tsx"],
    jobs: ["ci:audit-parity", "ci:test-docs", "ci:web-e2e"],
  },
  {
    name: "react-native-typescript-source",
    files: ["libraries/react-native-iap/src/utils/error.ts"],
    jobs: [
      "ci-react-native-iap.yml",
      "ci:audit-parity",
      "codeql:analyze-swift-wrappers/react-native",
    ],
  },
  {
    name: "jdk-pin",
    files: [".java-version"],
    jobs: [...nativeWorkflows, "ci:test-android"],
  },
  {
    name: "xcode-pin",
    files: [".github/actions/setup-xcode/action.yml"],
    jobs: [
      "ci-flutter-inapp-purchase.yml",
      "ci-godot-iap.yml",
      "ci-maui-iap.yml",
      "ci:audit-lockfile",
      "ci:audit-parity",
      "ci:test-ios",
      "ci:test-ios-compiler-boundaries",
      "codeql:analyze-swift",
      ...ALL_SWIFT_WRAPPERS,
    ],
  },
  {
    name: "independent-bun-lock",
    files: ["libraries/expo-iap/example/bun.lock"],
    jobs: [
      "ci-expo-iap.yml",
      "ci:audit-lockfile",
      "ci:audit-parity",
      "codeql:analyze-swift-wrappers/expo",
      "codeql:analyze-swift-wrappers/expo-onside",
    ],
  },
]);

function findVocabularyViolations(scopes) {
  const findings = [];

  for (const [scope, patterns] of scopes) {
    const hasExclude = patterns.some((pattern) => pattern.startsWith("!"));

    for (const pattern of patterns) {
      if (pattern.startsWith("!") && pattern !== DOCS_EXCLUDE) {
        findings.push(
          `${scope}: unsupported negation '${pattern}'; only '${DOCS_EXCLUDE}' is proven equivalent across both matchers`,
        );
        continue;
      }

      if (
        hasExclude &&
        !pattern.startsWith("!") &&
        (pattern.endsWith(".md") || pattern.endsWith(".mdx"))
      ) {
        findings.push(
          `${scope}: positive '${pattern}' targets markdown and would be unreachable behind '${DOCS_EXCLUDE}'`,
        );
      }

      const body = pattern.startsWith("!") ? pattern.slice(1) : pattern;
      const literal = body.endsWith("/**") ? body.slice(0, -3) : body;

      if (
        body !== "**/*.md" &&
        !isAnyDepthName(body) &&
        /[*?+[\]{}]/u.test(literal)
      ) {
        findings.push(
          `${scope}: pattern '${pattern}' is outside the audited vocabulary`,
        );
      }
    }
  }

  return findings;
}

function findQuantifierViolations(root) {
  const codeql = readWorkflow(root, "codeql.yml");
  const ci = readWorkflow(root, "ci.yml");
  const steps = [
    [
      "codeql.yml",
      "codeql-scope",
      "core",
      dornyStep(codeql, "codeql-scope", "core"),
    ],
    [
      "codeql.yml",
      "codeql-scope",
      "wrappers",
      dornyStep(codeql, "codeql-scope", "wrappers"),
    ],
    ["ci.yml", "changes", "filter", dornyStep(ci, "changes", "filter")],
  ];

  return steps.flatMap(([file, jobId, stepId, { step, filters }]) => {
    const negates = Object.values(filters).some((patterns) =>
      patterns.some((pattern) => pattern.startsWith("!")),
    );

    if (
      !negates ||
      step.with["predicate-quantifier"] === "some-with-excludes"
    ) {
      return [];
    }

    return [
      `${file}:${jobId}/${stepId}: negated patterns require predicate-quantifier: some-with-excludes`,
    ];
  });
}

// Inputs below come from this checkout, even when a test patches the workflows.
let trackedCache;

function tracked() {
  if (!trackedCache) {
    const listing = execFileSync("git", ["ls-files", "-s", "-z"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    const files = new Map();
    const directories = new Set();

    for (const line of listing.split("\0").filter(Boolean)) {
      const [meta, file] = line.split("\t");
      files.set(file, meta.startsWith("120000"));
      for (let dir = path.posix.dirname(file); dir !== "."; ) {
        directories.add(dir);
        dir = path.posix.dirname(dir);
      }
    }

    trackedCache = { files, directories };
  }

  return trackedCache;
}

function readSource(file) {
  return fs.readFileSync(path.join(repositoryRoot, file), "utf8");
}

// A directory input stands for every non-markdown file under it.
function expandInput(input) {
  const { files, directories } = tracked();

  if (files.has(input)) {
    return [input];
  }

  return directories.has(input)
    ? [...files.keys()].filter(
        (file) => file.startsWith(`${input}/`) && !file.endsWith(".md"),
      )
    : [];
}

export function coverageFindings(scope, patterns, inputs) {
  return [...inputs].flatMap(([input, source]) => {
    const files = expandInput(input);

    if (files.length === 0) {
      return [
        `${scope}: ${source} reads ${input}, which no tracked file backs`,
      ];
    }

    return files.every((file) => matchesFilter(patterns, [file]))
      ? []
      : [
          `${scope}: paths miss ${tracked().directories.has(input) ? `${input}/**` : input}, which ${source} reads`,
        ];
  });
}

const WORKSPACE =
  /\$\{\{\s*github\.workspace\s*\}\}|\$\{?GITHUB_WORKSPACE\}?/gu;

function resolveRunToken(token, directory) {
  if (token.startsWith("@ROOT@/")) {
    return path.posix.normalize(token.slice("@ROOT@/".length));
  }

  if (!token || /^[$\-/]/u.test(token)) {
    return null;
  }

  const resolved = path.posix.normalize(path.posix.join(directory, token));
  return resolved.startsWith("..") ? null : resolved;
}

function workingDirectory(value) {
  return (value ?? "").replace(WORKSPACE, "").replace(/^\/+/u, "") || ".";
}

// Repository files a set of steps names: scripts they run, files they read,
// and local composite actions with everything those run in turn.
function stepInputs(steps, directory, inputs, source) {
  for (const step of steps ?? []) {
    if (typeof step.uses === "string" && step.uses.startsWith("./")) {
      const action = path.posix.join(step.uses.slice(2), "action.yml");
      inputs.set(action, source);
      stepInputs(
        parseYaml(readSource(action)).runs?.steps,
        ".",
        inputs,
        action,
      );
    }

    if (typeof step.run !== "string") {
      continue;
    }

    let cwd = workingDirectory(step["working-directory"] ?? directory);
    const tokens = step.run
      .replace(WORKSPACE, "@ROOT@")
      .split(/[\s"'=;|&()<>`]+/u);

    for (const [index, raw] of tokens.entries()) {
      const target = resolveRunToken(raw.replace(/\\$/u, ""), cwd);

      if (!target) {
        continue;
      }

      if (tokens[index - 1] === "cd" && tracked().directories.has(target)) {
        cwd = target;
      } else if (tracked().files.has(target)) {
        inputs.set(target, source);
      }
    }
  }

  return inputs;
}

/**
 * Files a Gradle script reads and, for a settings script, the projects and
 * builds it includes; an included build's own settings are followed too.
 * Walk-up lookups name a root-relative `packages/...` path, so that is the
 * fallback when a literal does not resolve beside the script.
 *
 * Only quoted `../` or `packages/` literals count: that is how every
 * cross-directory edge is written today. Paths built by concatenation, bare
 * names beside the script, and files Gradle reads implicitly
 * (gradle.properties, version catalogs) are not seen; pin those with a case.
 */
function gradleInputs(file, inputs) {
  const includesProjects = /(?:^|\/)settings\.gradle(?:\.kts)?$/u.test(file);

  for (const [, literal] of readSource(file).matchAll(
    /["']((?:\.\.\/)+[^"'$\s]+|packages\/[^"'$\s]+)["']/gu,
  )) {
    const target = [
      path.posix.normalize(path.posix.join(path.posix.dirname(file), literal)),
      literal.replace(/^(?:\.\.\/)+/u, ""),
    ].find(
      (candidate) =>
        tracked().files.has(candidate) ||
        (includesProjects && tracked().directories.has(candidate)),
    );

    if (!target || inputs.has(target)) {
      continue;
    }

    inputs.set(target, file);
    for (const settings of ["settings.gradle", "settings.gradle.kts"]) {
      if (tracked().files.has(`${target}/${settings}`)) {
        gradleInputs(`${target}/${settings}`, inputs);
      }
    }
  }
}

// Build inputs a directory pulls in through its symlinks and Gradle scripts.
function directoryInputs(directory, inputs) {
  for (const [file, isLink] of tracked().files) {
    if (!file.startsWith(`${directory}/`)) {
      continue;
    }

    if (isLink) {
      const target = path.posix.normalize(
        path.posix.join(
          path.posix.dirname(file),
          fs.readlinkSync(path.join(repositoryRoot, file)),
        ),
      );
      if (!target.startsWith(`${directory}/`)) {
        inputs.set(target, file);
      }
    } else if (/\.gradle(?:\.kts)?$/u.test(file)) {
      gradleInputs(file, inputs);
    }
  }

  return inputs;
}

/**
 * A path-filtered job must run when anything it reads changes. Inputs come
 * from the workflow file and its steps; a wrapper's Gradle wiring and
 * symlinks; and, for a ci.yml job, each package directory it runs in with
 * that package's Gradle wiring and workspace dependencies. A new edge fails
 * here until the filter covers it. CodeQL scopes are not derived; their
 * cases above pin them.
 */
function findConsumedInputViolations(root) {
  const findings = [];

  for (const name of nativeWorkflows) {
    const document = readWorkflow(root, name);
    const patterns = document.on.pull_request.paths;
    const inputs = new Map([[`.github/workflows/${name}`, "the workflow"]]);
    const defaults = document.defaults?.run?.["working-directory"];

    for (const job of Object.values(document.jobs)) {
      stepInputs(
        job.steps,
        job.defaults?.run?.["working-directory"] ?? defaults,
        inputs,
        name,
      );
    }

    for (const pattern of patterns) {
      const library = pattern.match(/^(libraries\/[^/]+)\/\*\*$/u)?.[1];
      if (library) {
        directoryInputs(library, inputs);
      }
    }

    findings.push(...coverageFindings(name, patterns, inputs));
  }

  const ci = readWorkflow(root, "ci.yml");
  const { filters } = dornyStep(ci, "changes", "filter");
  const directoryOf = new Map(
    [...tracked().files.keys()]
      .filter((file) =>
        /^(?:packages|specs)\/[^/]+\/package\.json$/u.test(file),
      )
      .map((file) => [
        JSON.parse(readSource(file)).name,
        path.posix.dirname(file),
      ]),
  );

  for (const [filter, labels] of Object.entries(ciFilterJobs)) {
    const inputs = new Map([[".github/workflows/ci.yml", "the workflow"]]);

    for (const label of labels) {
      const jobId = label.replace(/^ci:/u, "");
      const steps = ci.jobs[jobId]?.steps ?? [];
      stepInputs(steps, ".", inputs, `ci.yml ${jobId}`);

      for (const step of steps) {
        const directory = workingDirectory(step["working-directory"]);
        if (directory === ".") {
          continue;
        }

        if (!inputs.has(directory)) {
          inputs.set(directory, `ci.yml ${jobId}`);
        }
        directoryInputs(directory, inputs);
        for (const dependency of workspaceDependencies(
          directory,
          directoryOf,
        )) {
          inputs.set(dependency, `${directory}/package.json`);
        }
      }
    }

    findings.push(
      ...coverageFindings(`ci.yml ${filter}`, filters[filter] ?? [], inputs),
    );
  }

  // compile:ai reads the inventory in context-files.ts, which no step names.
  const context = new Map();
  for (const entry of [...CONTEXT_INPUT_PATHS, ...CONTEXT_OUTPUT_PATHS]) {
    const { files, directories } = tracked();
    const members = directories.has(entry)
      ? [...files.keys()].filter((file) => file.startsWith(`${entry}/`))
      : [entry];
    for (const file of members) {
      context.set(file, "scripts/agent/context-files.ts");
    }
  }
  findings.push(
    ...coverageFindings("ci.yml agent", filters.agent ?? [], context),
  );

  return findings;
}

// Workspace packages a package builds against, by directory.
function workspaceDependencies(directory, directoryOf) {
  const manifest = `${directory}/package.json`;

  if (!tracked().files.has(manifest)) {
    return [];
  }

  const { dependencies, devDependencies, peerDependencies } = JSON.parse(
    readSource(manifest),
  );

  return Object.entries({
    ...dependencies,
    ...devDependencies,
    ...peerDependencies,
  })
    .filter(
      ([name, version]) =>
        String(version).startsWith("workspace:") && directoryOf.has(name),
    )
    .map(([name]) => directoryOf.get(name));
}

function findKitConsumerFilterViolations(root) {
  const workflow = readWorkflow(root, "deploy-kit.yml");
  const pullRequestPaths = workflow.on.pull_request.paths ?? [];
  const pushPaths = workflow.on.push.paths ?? [];

  const findings = KIT_CLIENT_CONTRACT_PATHS.filter(
    (requiredPath) => !pullRequestPaths.includes(requiredPath),
  ).map(
    (requiredPath) =>
      `deploy-kit.yml: pull_request.paths must include '${requiredPath}' — MCP compiles against this client contract`,
  );

  for (const [event, paths] of [
    ["pull_request", pullRequestPaths],
    ["push", pushPaths],
  ]) {
    if (!paths.includes(KIT_RUNTIME_CONTRACT_PATH)) {
      findings.push(
        `deploy-kit.yml: ${event}.paths must include '${KIT_RUNTIME_CONTRACT_PATH}' — the kit binary embeds this runtime contract`,
      );
    }
  }

  const deployStep = workflow.jobs.deploy.steps.find(
    (step) => step.name === "Deploy",
  );
  if (deployStep?.["working-directory"] !== "${{ github.workspace }}") {
    findings.push(
      "deploy-kit.yml: Deploy must run from github.workspace so the monorepo Docker context contains root manifests and nested specifications",
    );
  }

  return findings;
}

function findCoverageViolations(root) {
  const findings = [];
  const codeql = readWorkflow(root, "codeql.yml");
  const ci = readWorkflow(root, "ci.yml");

  for (const [name, document] of [
    ["codeql.yml", codeql],
    ["ci.yml", ci],
  ]) {
    for (const event of ["pull_request", "push"]) {
      const trigger = document.on[event] ?? {};

      if (trigger.paths || trigger["paths-ignore"]) {
        findings.push(
          `${name}: ${event} must stay unfiltered; job-level gating keeps skipped checks reportable`,
        );
      }
    }
  }

  for (const event of ["schedule", "workflow_dispatch"]) {
    if (!(event in codeql.on)) {
      findings.push(`codeql.yml: ${event} coverage was removed`);
    }
  }

  for (const output of ["swift_core", "swift_wrappers", "swift_components"]) {
    const expression = codeql.jobs["codeql-scope"].outputs[output] ?? "";

    if (!expression.includes("github.event_name != 'pull_request'")) {
      findings.push(`codeql.yml: ${output} lost its non-pull_request fallback`);
    }
  }

  for (const stepId of ["core", "wrappers"]) {
    const { step } = dornyStep(codeql, "codeql-scope", stepId);

    if (step.if !== "github.event_name == 'pull_request'") {
      findings.push(
        `codeql.yml: ${stepId} step must stay pull_request-only so other events fall back to full scope`,
      );
    }
  }

  for (const jobId of unconditionalCiJobs) {
    const job = ci.jobs[jobId];

    if (!job) {
      findings.push(`ci.yml: job ${jobId} is missing`);
      continue;
    }

    if ("needs" in job || "if" in job) {
      findings.push(`ci.yml: job ${jobId} must stay unconditional`);
    }
  }

  // A filter only means something through the job it gates, so pin that wiring.
  const { filters: ciFilters } = dornyStep(ci, "changes", "filter");

  for (const [name, labels] of Object.entries(ciFilterJobs)) {
    for (const label of labels) {
      const jobId = label.replace(/^ci:/u, "");
      const job = ci.jobs[jobId];

      if (!(name in ciFilters)) {
        findings.push(
          `ci.yml: filter '${name}' was removed but job ${jobId} still gates on it`,
        );
        continue;
      }

      if (!job) {
        findings.push(`ci.yml: job ${jobId} is missing; update ciFilterJobs`);
        continue;
      }

      if (job.if !== `needs.changes.outputs.${name} == 'true'`) {
        findings.push(
          `ci.yml: job ${jobId} must gate on needs.changes.outputs.${name}`,
        );
      }
    }

    const output = pushAlwaysFilters.includes(name)
      ? `\${{ github.event_name != 'pull_request' || steps.filter.outputs.${name} }}`
      : `\${{ steps.filter.outputs.${name} }}`;
    if (name in ciFilters && ci.jobs.changes.outputs[name] !== output) {
      findings.push(
        `ci.yml: changes job must publish the ${name} filter output as ${output}`,
      );
    }
  }

  // Every job must sit in exactly one inventory, or its gating is invisible
  // to this audit and a mis-gated job ships without any check failing.
  const inventoried = new Set([
    ...unconditionalCiJobs,
    ...Object.values(ciFilterJobs)
      .flat()
      .map((label) => label.replace(/^ci:/u, "")),
  ]);
  for (const jobId of Object.keys(ci.jobs)) {
    if (!inventoried.has(jobId)) {
      findings.push(
        `ci.yml: job ${jobId} is in neither unconditionalCiJobs nor ciFilterJobs; add it so its gating is audited`,
      );
    }
  }

  for (const name of nativeWorkflows) {
    const document = readWorkflow(root, name);
    const pullRequest = document.on.pull_request.paths;
    const push = document.on.push.paths;

    if (JSON.stringify(pullRequest) !== JSON.stringify(push)) {
      findings.push(`${name}: push.paths must equal pull_request.paths`);
    }

    if (pullRequest.at(-1) !== DOCS_EXCLUDE) {
      findings.push(`${name}: '${DOCS_EXCLUDE}' must be the last paths entry`);
    }

    if (!pullRequest.some((pattern) => !pattern.startsWith("!"))) {
      findings.push(`${name}: paths needs at least one non-negated pattern`);
    }
  }

  return findings;
}

export function findPolicyViolations(root = repositoryRoot) {
  return [
    ...findQuantifierViolations(root),
    ...findVocabularyViolations(readScopes(root)),
    ...findCoverageViolations(root),
    ...findConsumedInputViolations(root),
    ...findKitConsumerFilterViolations(root),
  ];
}

export function auditCiPathFilters(root = repositoryRoot) {
  const selectionFindings = cases.flatMap(({ name, files, jobs }) => {
    const expected = [...jobs].sort();
    const actual = selectJobs(files, root);

    return JSON.stringify(actual) === JSON.stringify(expected)
      ? []
      : [`${name}: expected [${expected}], got [${actual}]`];
  });

  return [...selectionFindings, ...findPolicyViolations(root)].sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = auditCiPathFilters();

  if (errors.length === 0) {
    console.log("CI path filter audit: clean.");
  } else {
    console.error("CI path filter audit failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
