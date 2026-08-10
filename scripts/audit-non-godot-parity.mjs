#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_SYNC_MANIFEST } from "../packages/gql/generated-sync-manifest.mjs";
import { collectGeneratedSyncDrift } from "../packages/gql/scripts/verify-generated-sync.mjs";
import { collectCompletedRemovalFailures } from "./audit-deprecation-schedule.mjs";
import { usesApi24ConcurrentKeySet } from "./audit-android-api-compat.mjs";
import { assertSpecMatchesNativeFloor } from "./release-branch-policy.mjs";
import {
  collectPurchasePayloadParityFailures,
  extractBalancedAfterMarker,
  maskKotlinCommentsAndStrings,
  maskTypeScriptCommentsAndStrings,
} from "./audit-purchase-payload-parity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(
  process.execPath,
  [
    "--test",
    path.resolve(
      root,
      "packages/gql/scripts/standalone-generated-refreshers.test.mjs",
    ),
  ],
  { stdio: "inherit" },
);
execFileSync(
  process.execPath,
  ["--test", path.resolve(root, "scripts/audit-deprecation-schedule.test.mjs")],
  { stdio: "inherit" },
);
execFileSync(
  process.execPath,
  ["--test", path.resolve(root, "scripts/audit-android-api-compat.test.mjs")],
  { stdio: "inherit" },
);
execFileSync(
  process.execPath,
  ["--test", path.resolve(root, "scripts/assert-lcov-coverage.test.mjs")],
  { stdio: "inherit" },
);
execFileSync(
  process.execPath,
  [
    "--test",
    path.resolve(root, "scripts/audit-purchase-payload-parity.test.mjs"),
  ],
  { stdio: "inherit" },
);
const failures = [];

const EXPO_EXAMPLE_ROOT = "libraries/expo-iap/example";

function checkNativeSpecVersionFloor() {
  try {
    assertSpecMatchesNativeFloor(readJson("openiap-versions.json"));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function checkDeprecationSchedule() {
  for (const issue of collectCompletedRemovalFailures()) {
    fail(issue);
  }
}

// Built via concatenation so repo-wide TO-DO searches don't flag these
// forbidden-pattern needles as real code debt.
const TODO_MARKER = "TO" + "DO";

const parityCoveredLibraries = new Set([
  "expo-iap",
  "flutter_inapp_purchase",
  "kmp-iap",
  "maui-iap",
  "react-native-iap",
]);

const parityExcludedLibraries = new Set([
  // Godot is intentionally excluded until its example parity is brought back
  // into the same automated build/test lane as the other SDK examples.
  "godot-iap",
]);

const featureSpecs = {
  "all-products": {},
  "purchase-flow": {},
  "subscription-flow": {},
  "available-purchases": {},
  "offer-code": {},
  "alternative-billing": {},
};

const operationParityRegistry = {
  Mutation: [
    "acknowledgePurchaseAndroid",
    "beginRefundRequestIOS",
    "clearTransactionIOS",
    "consumePurchaseAndroid",
    "createBillingProgramReportingDetailsAndroid",
    "deepLinkToSubscriptions",
    "endConnection",
    "finishTransaction",
    "initConnection",
    "isBillingProgramAvailableAndroid",
    "launchExternalLinkAndroid",
    "openRedeemOfferCodeAndroid",
    "presentCodeRedemptionSheetIOS",
    "presentExternalPurchaseLinkIOS",
    "presentExternalPurchaseNoticeSheetIOS",
    "requestPurchase",
    "restorePurchases",
    "showBillingProgramInformationDialogAndroid",
    "showExternalPurchaseCustomLinkNoticeIOS",
    "showInAppMessagesAndroid",
    "showManageSubscriptionsIOS",
    "syncIOS",
    "verifyPurchase",
    "verifyPurchaseWithProvider",
  ],
  Query: [
    "canPresentExternalPurchaseNoticeIOS",
    "currentEntitlementIOS",
    "fetchProducts",
    "getActiveSubscriptions",
    "getAllTransactionsIOS",
    "getAppTransactionIOS",
    "getAvailablePurchases",
    "getBillingChoiceInfoAndroid",
    "getExternalPurchaseCustomLinkTokenIOS",
    "getPendingTransactionsIOS",
    "getPromotedProductIOS",
    "getReceiptDataIOS",
    "getStorefront",
    "getTransactionJwsIOS",
    "hasActiveSubscriptions",
    "isEligibleForExternalPurchaseCustomLinkIOS",
    "isEligibleForIntroOfferIOS",
    "isTransactionVerifiedIOS",
    "latestTransactionIOS",
    "subscriptionStatusIOS",
  ],
  Subscription: [
    "developerProvidedBillingAndroid",
    "promotedProductIOS",
    "purchaseError",
    "purchaseUpdated",
    "subscriptionBillingIssue",
    "userChoiceBillingAndroid",
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
  return fs.readFileSync(abs(relativePath), "utf8");
}

function extractRunBlockContaining(source, marker) {
  const lines = source.split("\n");
  const markerIndex = lines.findIndex((line) => line.includes(marker));
  if (markerIndex < 0) return "";

  let runIndex = markerIndex;
  while (runIndex >= 0 && !/^\s*run:\s*\|\s*$/.test(lines[runIndex])) {
    runIndex -= 1;
  }
  if (runIndex < 0) return "";

  const runIndent = lines[runIndex].match(/^\s*/)[0].length;
  let endIndex = runIndex + 1;
  while (endIndex < lines.length) {
    const line = lines[endIndex];
    if (line.trim() !== "" && line.match(/^\s*/)[0].length <= runIndent) {
      break;
    }
    endIndex += 1;
  }
  return lines.slice(runIndex, endIndex).join("\n");
}

function extractNamedWorkflowStep(source, name) {
  const lines = source.split("\n");
  const startIndex = lines.findIndex(
    (line) => line.trim() === `- name: ${name}`,
  );
  if (startIndex < 0) return null;

  const stepIndent = lines[startIndex].match(/^\s*/)[0].length;
  let endIndex = startIndex + 1;
  while (endIndex < lines.length) {
    const line = lines[endIndex];
    if (
      line.trim() !== "" &&
      line.match(/^\s*/)[0].length === stepIndent &&
      line.trim().startsWith("- ")
    ) {
      break;
    }
    endIndex += 1;
  }
  return {
    endIndex,
    source: lines.slice(startIndex, endIndex).join("\n"),
    startIndex,
  };
}

function findExecutableLineIndex(source, pattern, startIndex = 0) {
  return source.split("\n").findIndex((line, index) => {
    if (index < startIndex || line.trimStart().startsWith("#")) return false;
    return pattern.test(line);
  });
}

function extractAppleExistingTagBranches(source) {
  const lines = source.split("\n");
  const bareStart = lines.findIndex((line) =>
    line.includes('if git rev-parse "$VERSION"'),
  );
  const legacyStart = lines.findIndex((line) =>
    line.includes('elif git rev-parse "apple-v$VERSION"'),
  );
  if (bareStart < 0 || legacyStart <= bareStart) return null;

  const legacyIndent = lines[legacyStart].match(/^\s*/)[0].length;
  const outerElse = lines.findIndex(
    (line, index) =>
      index > legacyStart &&
      line.match(/^\s*/)[0].length === legacyIndent &&
      line.trim() === "else",
  );
  if (outerElse <= legacyStart) return null;
  return {
    bare: lines.slice(bareStart, legacyStart).join("\n"),
    legacy: lines.slice(legacyStart, outerElse).join("\n"),
  };
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

function listTrackedFiles(relativePath) {
  return execFileSync("git", ["ls-files", "--", relativePath], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter((file) => file.length > 0 && exists(file));
}

function checkNoOutboundWebhookStream() {
  const forbiddenFiles = [
    "packages/kit/server/api/v1/webhookStreamDrain.ts",
    "packages/kit/convex/webhooks/query.ts",
    "packages/gql/src/webhook.graphql",
    "packages/gql/src/webhook-client.ts",
    "libraries/react-native-iap/src/webhook-client.ts",
    "libraries/react-native-iap/src/hooks/useWebhookEvents.ts",
    "libraries/expo-iap/src/webhook-client.ts",
    "libraries/expo-iap/src/useWebhookEvents.ts",
    "libraries/flutter_inapp_purchase/lib/webhook_client.dart",
    "libraries/godot-iap/addons/godot-iap/webhook_client.gd",
    "libraries/godot-iap/addons/godot-iap/webhook_client.gd.uid",
    "libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/WebhookClient.kt",
    "libraries/maui-iap/src/OpenIap.Maui/WebhookClient.cs",
    "packages/kit/convex/webhooks/query.ts",
    "packages/kit/convex/webhooks/validators.ts",
  ];
  for (const relativePath of forbiddenFiles) {
    if (exists(relativePath)) {
      fail(
        `outbound IAPKit webhook streams are forbidden; remove ${relativePath}`,
      );
    }
  }

  const forbiddenIdentifiers = [
    "/v1/webhooks/stream",
    "connectWebhookStream",
    "useWebhookEvents",
    "WebhookStream",
    "WebhookClient",
    "webhookEventsSince",
    "webhookStreamCursor",
    "webhook_stream",
    "webhook-stream",
  ];
  const removalRegressionTest = "packages/kit/server/api/v1/webhooks.test.ts";
  expectIncludes(
    removalRegressionTest,
    [
      'it("does not expose outbound webhook stream routes"',
      '"/webhooks/stream"',
      '"/webhooks/stream/openiap-kit_pk_mobile"',
      "expect(response.status).toBe(404)",
    ],
    "outbound webhook route removal regression",
  );
  expectNotIncludes(
    "packages/kit/convex/_generated/api.d.ts",
    [
      "../webhooks/query.js",
      '"webhooks/query"',
      "../webhooks/validators.js",
      '"webhooks/validators"',
    ],
    "removed outbound Convex modules must not remain in generated API types",
  );
  const synchronizedGodotArtifacts = [
    "libraries/godot-iap/addons/godot-iap/android/GodotIap.debug.aar",
    "libraries/godot-iap/addons/godot-iap/android/GodotIap.release.aar",
    "libraries/godot-iap/addons/godot-iap/bin/ios/GodotIap.framework/GodotIap",
    "libraries/godot-iap/addons/godot-iap/bin/macos/GodotIap.framework/GodotIap",
  ];
  const forbiddenGodotArtifactSymbols = [
    "WebhookEvent",
    "SubscriptionState",
    "WebhookCancellationReason",
  ];
  for (const relativePath of synchronizedGodotArtifacts) {
    if (!exists(relativePath)) {
      fail(`missing tracked Godot runtime artifact: ${relativePath}`);
      continue;
    }
    const artifact = fs.readFileSync(abs(relativePath));
    for (const symbol of forbiddenGodotArtifactSymbols) {
      if (artifact.includes(Buffer.from(symbol))) {
        fail(
          `${relativePath} still embeds removed outbound webhook symbol ${JSON.stringify(
            symbol,
          )}; rebuild the tracked artifact`,
        );
      }
    }
  }

  const activeRoots = [
    "packages/gql/src",
    "packages/apple/Sources",
    "packages/apple/Example",
    "packages/google/openiap/src",
    "packages/google/Example",
    "packages/kit/server/api/v1",
    "packages/kit/convex/webhooks",
    "libraries/react-native-iap",
    "libraries/expo-iap",
    "libraries/flutter_inapp_purchase",
    "libraries/godot-iap",
    "libraries/kmp-iap",
    "libraries/maui-iap",
  ];
  for (const relativePath of activeRoots.flatMap(listTrackedFiles)) {
    if (relativePath === removalRegressionTest) continue;
    if (
      !/\.(?:c|cc|cs|dart|gd|graphql|h|java|js|json|kt|kts|md|mjs|mm|swift|ts|tsx|xaml)$/i.test(
        relativePath,
      )
    ) {
      continue;
    }
    const text = read(relativePath);
    if (/\bwebhook[\s_-]*stream\b/i.test(text)) {
      fail(`${relativePath} reintroduces a forbidden outbound webhook stream`);
    }
    if (
      /webhook/i.test(relativePath) &&
      (text.includes("text/event-stream") || /\bEventSource\b/.test(text))
    ) {
      fail(
        `${relativePath} reintroduces forbidden SSE transport in webhook code`,
      );
    }
    for (const identifier of forbiddenIdentifiers) {
      if (text.includes(identifier)) {
        fail(
          `${relativePath} reintroduces forbidden outbound webhook identifier ${JSON.stringify(
            identifier,
          )}`,
        );
      }
    }
  }

  for (const relativePath of listTrackedFiles("packages/docs/src/pages/docs")) {
    if (relativePath.includes("/updates/")) continue;
    const text = read(relativePath);
    for (const identifier of forbiddenIdentifiers) {
      if (text.includes(identifier)) {
        fail(
          `${relativePath} documents forbidden outbound webhook identifier ${JSON.stringify(
            identifier,
          )}`,
        );
      }
    }
  }
}

function listDirectories(relativePath) {
  if (!exists(relativePath)) return [];
  return fs
    .readdirSync(abs(relativePath), { withFileTypes: true })
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

function expectCodeBlocksNotInclude(
  relativePath,
  needles,
  label = relativePath,
) {
  expectFile(relativePath);
  if (!exists(relativePath)) return;
  const text = read(relativePath);
  const codeBlocks = [...text.matchAll(/<CodeBlock\b[\s\S]*?<\/CodeBlock>/g)]
    .map((match) => match[0])
    .join("\n");
  for (const needle of needles) {
    if (codeBlocks.includes(needle)) {
      fail(`${label} code examples must not include ${JSON.stringify(needle)}`);
    }
  }
}

function expectNoMatch(relativePath, regex, label = relativePath) {
  expectFile(relativePath);
  if (!exists(relativePath)) return;
  const text = read(relativePath);
  let matched = false;
  if (regex instanceof RegExp) {
    regex.lastIndex = 0;
    matched = regex.test(text);
  } else {
    matched = text.includes(regex);
  }
  if (matched) {
    fail(`${label} must not match ${regex}`);
  }
}

function expectMatch(relativePath, regex, label = relativePath) {
  expectFile(relativePath);
  if (!exists(relativePath)) return;
  const text = read(relativePath);
  regex.lastIndex = 0;
  if (!regex.test(text)) {
    fail(`${label} must match ${regex}`);
  }
}

function expectOptionalIncludes(relativePath, needles, label = relativePath) {
  if (!exists(relativePath)) return;
  expectIncludes(relativePath, needles, label);
}

function expectOptionalNotIncludes(
  relativePath,
  needles,
  label = relativePath,
) {
  if (!exists(relativePath)) return;
  expectNotIncludes(relativePath, needles, label);
}

function expectSameFile(
  sourcePath,
  targetPath,
  label = targetPath,
  normalize = (value) => value,
) {
  expectFile(sourcePath);
  expectFile(targetPath);
  if (!exists(sourcePath) || !exists(targetPath)) return;
  const source = normalize(read(sourcePath));
  const target = normalize(read(targetPath));
  if (source !== target) {
    fail(`${label} is not synced with ${sourcePath}`);
  }
}

function expectSymlinkTarget(
  relativePath,
  expectedTarget,
  label = relativePath,
) {
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
    fail(`${label} missing parity registry coverage: ${missing.join(", ")}`);
  }
  if (stale.length > 0) {
    fail(`${label} parity registry has stale entries: ${stale.join(", ")}`);
  }
}

function checkFrameworkCiAndCoverageBadges() {
  const contracts = [
    {
      componentId: "react-native-iap",
      componentName: "React Native IAP",
      coveragePath: "libraries/react-native-iap/src",
      generatedCoverageFile: "types.ts",
      libraryPath: "libraries/react-native-iap",
      readmePath: "libraries/react-native-iap/README.md",
      testCommand: "run: yarn test:ci",
      testJob: "test",
      workflowFile: "ci-react-native-iap.yml",
    },
    {
      componentId: "expo-iap",
      componentName: "Expo IAP",
      coveragePath: "libraries/expo-iap/src",
      generatedCoverageFile: "types.ts",
      libraryPath: "libraries/expo-iap",
      readmePath: "libraries/expo-iap/README.md",
      testCommand: "run: bun run test:coverage",
      testJob: "test",
      workflowFile: "ci-expo-iap.yml",
    },
    {
      componentId: "flutter-inapp-purchase",
      componentName: "flutter_inapp_purchase",
      coveragePath: "libraries/flutter_inapp_purchase/lib",
      generatedCoverageFile: "types.dart",
      libraryPath: "libraries/flutter_inapp_purchase",
      readmePath: "libraries/flutter_inapp_purchase/README.md",
      testCommand: "run: flutter test --coverage",
      testJob: "analyze-and-test",
      workflowFile: "ci-flutter-inapp-purchase.yml",
    },
    {
      codecovTargetPath: "packages/kit/server",
      codecovConfigPush: false,
      componentId: "iapkit-server",
      componentName: "IAPKit Server",
      coveragePath: "packages/kit/server",
      generatedCoverageFile: null,
      libraryPath: "packages/kit",
      readmePath: "packages/kit/README.md",
      testCommand: "run: bun run test:coverage",
      testJob: "verify",
      workflowFile: "deploy-kit.yml",
    },
  ];

  function extractHttpsUrls(source) {
    return [...source.matchAll(/https:\/\/[^\s"'<>()[\]]+/g)].map((match) =>
      match[0].replace(/[,.;]+$/, ""),
    );
  }

  function parseUrl(value) {
    try {
      return new URL(value);
    } catch {
      return null;
    }
  }

  function hasMainBranchFilter(url) {
    if (url.searchParams.get("branch") === "main") return true;
    const query = url.searchParams.get("query") ?? "";
    return /(?:^|\s)branch:main(?:$|\s)/.test(query);
  }

  function extractWorkflowJob(source, jobName) {
    const lines = source.split("\n");
    const startIndex = lines.findIndex((line) => line === `  ${jobName}:`);
    if (startIndex < 0) return "";
    let endIndex = startIndex + 1;
    while (
      endIndex < lines.length &&
      !/^  [A-Za-z0-9_-]+:$/.test(lines[endIndex])
    ) {
      endIndex += 1;
    }
    return lines.slice(startIndex, endIndex).join("\n");
  }

  function extractTopLevelYamlSection(source, sectionName) {
    const lines = source.split("\n");
    const startIndex = lines.findIndex((line) => line === `${sectionName}:`);
    if (startIndex < 0) return "";
    let endIndex = startIndex + 1;
    while (
      endIndex < lines.length &&
      (lines[endIndex].trim() === "" || /^\s/.test(lines[endIndex]))
    ) {
      endIndex += 1;
    }
    return lines.slice(startIndex, endIndex).join("\n");
  }

  function checkDedicatedWorkflowBadge({ readmePath, workflowFile }) {
    const workflowPath = `.github/workflows/${workflowFile}`;
    expectFile(workflowPath);
    expectFile(readmePath);
    if (!exists(workflowPath) || !exists(readmePath)) return;

    const readmeUrls = extractHttpsUrls(read(readmePath))
      .map(parseUrl)
      .filter((url) => url !== null);
    const expectedWorkflowPath = `/hyodotdev/openiap/actions/workflows/${workflowFile}`;
    const workflowUrls = readmeUrls.filter(
      (url) =>
        url.hostname === "github.com" &&
        url.pathname.startsWith("/hyodotdev/openiap/actions/workflows/"),
    );
    const workflowBadge = workflowUrls.find(
      (url) => url.pathname === `${expectedWorkflowPath}/badge.svg`,
    );
    const workflowTarget = workflowUrls.find(
      (url) => url.pathname === expectedWorkflowPath,
    );
    if (!workflowBadge || !hasMainBranchFilter(workflowBadge)) {
      fail(`${readmePath} must render the main-branch ${workflowFile} badge`);
    }
    if (!workflowTarget || !hasMainBranchFilter(workflowTarget)) {
      fail(`${readmePath} must link to main-branch ${workflowFile} runs`);
    }
    if (
      workflowUrls.some(
        (url) =>
          url.pathname !== expectedWorkflowPath &&
          url.pathname !== `${expectedWorkflowPath}/badge.svg`,
      )
    ) {
      fail(
        `${readmePath} must not use a different GitHub Actions workflow badge or target`,
      );
    }
  }

  const markdownPaths = listTrackedFiles(".").filter((relativePath) =>
    /\.mdx?$/i.test(relativePath),
  );
  for (const markdownPath of markdownPaths) {
    const source = read(markdownPath);
    for (const match of source.matchAll(
      /https:\/\/github\.com\/hyodotdev\/openiap\/actions\/workflows\/([^/?#\s"'<>()[\]]+\.ya?ml)\b/gi,
    )) {
      let workflowFile = match[1];
      try {
        workflowFile = decodeURIComponent(workflowFile);
      } catch {
        fail(
          `${markdownPath} contains a malformed GitHub Actions workflow URL`,
        );
        continue;
      }
      if (!exists(`.github/workflows/${workflowFile}`)) {
        fail(
          `${markdownPath} links to missing GitHub Actions workflow ${workflowFile}`,
        );
      }
    }

    for (const value of extractHttpsUrls(source)) {
      const url = parseUrl(value);
      if (!url || !/(?:^|\.)codecov\.io$/i.test(url.hostname)) continue;

      if (
        [...url.searchParams.keys()].some((key) => /token/i.test(key)) ||
        /(?:your[_-]?token|placeholder)/i.test(value)
      ) {
        fail(`${markdownPath} must not expose a Codecov token or placeholder`);
      }

      const repository = url.pathname.match(
        /^\/(?:gh|github)\/([^/]+)(?:\/([^/]+))?/i,
      );
      if (
        repository &&
        (repository[1] !== "hyodotdev" || repository[2] !== "openiap")
      ) {
        fail(
          `${markdownPath} must link Codecov to the hyodotdev/openiap monorepo`,
        );
      }
    }
  }
  for (const ciBadgeContract of [
    ...contracts,
    {
      readmePath: "libraries/kmp-iap/README.md",
      workflowFile: "ci-kmp-iap.yml",
    },
  ]) {
    checkDedicatedWorkflowBadge(ciBadgeContract);
  }

  expectFile("codecov.yml");
  for (const nestedConfigPath of contracts.flatMap(({ libraryPath }) =>
    [".codecov.yml", ".codecov.yaml", "codecov.yml", "codecov.yaml"].map(
      (filename) => `${libraryPath}/${filename}`,
    ),
  )) {
    if (exists(nestedConfigPath)) {
      fail(`${nestedConfigPath} duplicates the root codecov.yml SSOT`);
    }
  }
  const alternateCodecovConfigs = [
    ".codecov.yml",
    ".codecov.yaml",
    "codecov.yaml",
    ...[".github", "dev"].flatMap((directory) =>
      [".codecov.yml", ".codecov.yaml", "codecov.yml", "codecov.yaml"].map(
        (filename) => `${directory}/${filename}`,
      ),
    ),
  ];
  for (const duplicateRootConfig of alternateCodecovConfigs) {
    if (exists(duplicateRootConfig)) {
      fail(`${duplicateRootConfig} duplicates the canonical root codecov.yml`);
    }
  }

  if (exists("codecov.yml")) {
    const codecovConfig = read("codecov.yml");
    const expectedComponentIds = contracts.map(
      ({ componentId }) => componentId,
    );
    const flagIds = uniqueMatches(
      extractTopLevelYamlSection(codecovConfig, "flags"),
      /^  ([A-Za-z0-9_-]+):$/gm,
    );
    const componentIds = uniqueMatches(
      extractTopLevelYamlSection(codecovConfig, "component_management"),
      /^    - component_id:\s*([A-Za-z0-9_-]+)$/gm,
    );
    expectSameSet("Codecov flags", expectedComponentIds, flagIds);
    expectSameSet("Codecov components", expectedComponentIds, componentIds);
    for (const contract of contracts) {
      const generatedCoveragePath = contract.generatedCoverageFile
        ? `${contract.coveragePath}/${contract.generatedCoverageFile}`
        : null;
      const flagBlock = [
        `  ${contract.componentId}:`,
        "    paths:",
        `      - \"${contract.coveragePath}/**\"`,
        "    carryforward: true",
      ].join("\n");
      const componentBlock = [
        `    - component_id: ${contract.componentId}`,
        `      name: ${contract.componentName}`,
        "      paths:",
        `        - \"${contract.coveragePath}/**\"`,
        "      flag_regexes:",
        `        - \"^${contract.componentId}$\"`,
      ].join("\n");
      if (!codecovConfig.includes(flagBlock)) {
        fail(
          `codecov.yml must define the ${contract.componentId} carryforward flag for ${contract.coveragePath}`,
        );
      }
      if (!codecovConfig.includes(componentBlock)) {
        fail(
          `codecov.yml must map component ${contract.componentId} to its matching path and flag`,
        );
      }
      if (
        generatedCoveragePath &&
        !codecovConfig.includes(`  - "${generatedCoveragePath}"`)
      ) {
        fail(
          `codecov.yml must ignore generated coverage file ${generatedCoveragePath}`,
        );
      }
      const statusBlock = [
        `      ${contract.componentId}:`,
        "        target: 90%",
        "        threshold: 0%",
        "        informational: false",
        "        flags:",
        `          - ${contract.componentId}`,
      ].join("\n");
      const statusOccurrences = codecovConfig.split(statusBlock).length - 1;
      if (statusOccurrences !== 2) {
        fail(
          `codecov.yml project and patch statuses must enforce 90% for ${contract.componentId}`,
        );
      }
    }
  }

  for (const contract of contracts) {
    const workflowPath = `.github/workflows/${contract.workflowFile}`;
    expectFile(workflowPath);
    expectFile(contract.readmePath);
    if (!exists(workflowPath) || !exists(contract.readmePath)) continue;

    const workflowSource = read(workflowPath);
    const testJob = extractWorkflowJob(workflowSource, contract.testJob);
    if (!testJob) {
      fail(`${workflowPath} is missing the ${contract.testJob} coverage job`);
      continue;
    }
    for (const needle of [
      "permissions:\n      contents: read\n      id-token: write",
      "fetch-depth: 0\n          persist-credentials: false",
      contract.testCommand,
      "run: node ../../scripts/assert-lcov-coverage.mjs coverage/lcov.info 90",
      "uses: codecov/codecov-action@v7",
      "use_oidc: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}",
      "fail_ci_if_error: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}",
      "disable_search: true",
      "files: coverage/lcov.info",
      `flags: ${contract.componentId}`,
      `name: ${contract.componentId}`,
      `network_prefix: ${contract.libraryPath}/`,
      `working-directory: ${contract.libraryPath}`,
    ]) {
      if (!testJob.includes(needle)) {
        fail(
          `${workflowPath} ${contract.testJob} must include ${JSON.stringify(needle)}`,
        );
      }
    }
    if ((testJob.match(/codecov\/codecov-action@v7/g) ?? []).length !== 1) {
      fail(
        `${workflowPath} ${contract.testJob} must upload exactly one coverage report`,
      );
    }
    const coverageAssertionIndex = testJob.indexOf(
      "run: node ../../scripts/assert-lcov-coverage.mjs coverage/lcov.info 90",
    );
    const uploadIndex = testJob.indexOf("uses: codecov/codecov-action@v7");
    if (coverageAssertionIndex < 0 || uploadIndex <= coverageAssertionIndex) {
      fail(
        `${workflowPath} must enforce LCOV coverage before uploading coverage`,
      );
    }
    if (/^\s+token:/m.test(testJob)) {
      fail(`${workflowPath} must use Codecov OIDC without a stored token`);
    }
    const eventBlock = (eventName) =>
      workflowSource.match(
        new RegExp(`^  ${eventName}:\\n[\\s\\S]*?(?=^  [a-z_]+:|^jobs:)`, "m"),
      )?.[0] ?? "";
    if (!eventBlock("pull_request").includes('- "codecov.yml"')) {
      fail(`${workflowPath} pull_request paths must include root codecov.yml`);
    }
    const pushIncludesCodecov = eventBlock("push").includes('- "codecov.yml"');
    if (contract.codecovConfigPush === false && pushIncludesCodecov) {
      fail(
        `${workflowPath} must not deploy production for a codecov.yml-only push`,
      );
    } else if (contract.codecovConfigPush !== false && !pushIncludesCodecov) {
      fail(`${workflowPath} push paths must include root codecov.yml`);
    }

    if (contract.componentId === "flutter-inapp-purchase") {
      const testIndex = testJob.indexOf(contract.testCommand);
      const filterIndex = testJob.indexOf(
        "run: dart run tool/filter_coverage.dart",
      );
      const uploadIndex = testJob.indexOf("uses: codecov/codecov-action@v7");
      if (
        testIndex < 0 ||
        filterIndex <= testIndex ||
        uploadIndex <= filterIndex
      ) {
        fail(
          `${workflowPath} must filter generated Flutter coverage before upload`,
        );
      }
    }

    const readmeUrls = extractHttpsUrls(read(contract.readmePath))
      .map(parseUrl)
      .filter((url) => url !== null);
    const expectedCodecovBadgePath =
      "/gh/hyodotdev/openiap/branch/main/graph/badge.svg";
    const codecovBadge = readmeUrls.find(
      (url) =>
        url.hostname === "codecov.io" &&
        url.pathname === expectedCodecovBadgePath &&
        url.searchParams.get("component") === contract.componentId &&
        [...url.searchParams.keys()].length === 1,
    );
    const codecovTarget = readmeUrls.find(
      (url) =>
        url.hostname === "app.codecov.io" &&
        url.pathname ===
          `/gh/hyodotdev/openiap/tree/main/${contract.codecovTargetPath ?? contract.libraryPath}`,
    );
    if (!codecovBadge) {
      fail(
        `${contract.readmePath} must render the token-free ${contract.componentId} Codecov component badge`,
      );
    }
    if (!codecovTarget) {
      fail(
        `${contract.readmePath} must link Codecov to its monorepo package tree`,
      );
    }
  }

  expectNoMatch(
    "libraries/kmp-iap/README.md",
    /https:\/\/(?:[A-Za-z0-9-]+\.)*codecov\.io\//i,
    "KMP README must not advertise Codecov before it produces a coverage report",
  );
}

function uniqueMatches(text, regex) {
  return [
    ...new Set([...text.matchAll(regex)].map((match) => match[1])),
  ].sort();
}

function discoverExpoProductIds() {
  const constantsPath = rel(EXPO_EXAMPLE_ROOT, "src/utils/constants.ts");
  expectFile(constantsPath);
  if (!exists(constantsPath)) return [];
  const ids = [
    ...new Set(
      read(constantsPath).match(/dev\.hyo\.martie\.[A-Za-z0-9._-]+/g) ?? [],
    ),
  ].sort();
  if (ids.length === 0) {
    fail(`${constantsPath} does not declare any SSOT example product IDs`);
  }
  return ids;
}

function discoverExpoRoutes() {
  const appDir = rel(EXPO_EXAMPLE_ROOT, "app");
  if (!exists(appDir)) {
    fail(`missing Expo SSOT app directory: ${appDir}`);
    return [];
  }

  return fs
    .readdirSync(abs(appDir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => entry.name.replace(/\.tsx$/, ""))
    .filter((route) => !["_layout", "index", "+not-found"].includes(route))
    .sort();
}

function parseGeneratedOperations(kind) {
  const sourcePath = GENERATED_SYNC_MANIFEST.typescript.source;
  expectFile(sourcePath);
  if (!exists(sourcePath)) return [];
  const match = read(sourcePath).match(
    new RegExp(`export interface ${kind} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match) {
    fail(`${sourcePath} is missing export interface ${kind}`);
    return [];
  }
  return [...match[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*)\??:\s/gm)]
    .map((item) => item[1])
    .sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTopLevelConstDeclaration(text, constName) {
  const match = new RegExp(
    `(^|\\n)(?:export\\s+)?const\\s+${escapeRegExp(constName)}\\b`,
  ).exec(text);
  if (!match) return "";

  const start = match.index + match[1].length;
  const rest = text.slice(start + 1);
  const next = /\n(?:export\s+)?(?:const|function|class|type|interface)\s/.exec(
    rest,
  );
  const end = next ? start + 1 + next.index : text.length;
  return text.slice(start, end);
}

function hasTypeScriptFieldBinding(text, operation, fieldType) {
  return [operation, `${operation}Field`].some((constName) => {
    const declaration = getTopLevelConstDeclaration(text, constName);
    return (
      declaration.includes(`${fieldType}<`) &&
      (declaration.includes(`'${operation}'`) ||
        declaration.includes(`"${operation}"`))
    );
  });
}

function expectTypeScriptFieldBindings(label, files, kind) {
  const text = files.map((file) => read(file)).join("\n");
  const fieldType = `${kind}Field`;
  const missing = parseGeneratedOperations(kind).filter(
    (operation) => !hasTypeScriptFieldBinding(text, operation, fieldType),
  );
  if (missing.length > 0) {
    fail(`${label} missing ${fieldType} bindings: ${missing.join(", ")}`);
  }
}

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return "";
  const end = endMarker
    ? text.indexOf(endMarker, start + startMarker.length)
    : -1;
  return text.slice(start, end < 0 ? text.length : end);
}

function expectFlutterHandlers(kind, block) {
  if (!block) {
    fail(`Flutter ${kind}Handlers block is missing`);
    return;
  }
  const missing = parseGeneratedOperations(kind).filter(
    (operation) =>
      !new RegExp(`\\b${escapeRegExp(operation)}\\s*:`).test(block),
  );
  if (missing.length > 0) {
    fail(
      `Flutter ${kind}Handlers missing generated operations: ${missing.join(
        ", ",
      )}`,
    );
  }
}

function parseGodotOperationFields() {
  const fields = [];
  const lines = read(GENERATED_SYNC_MANIFEST.gdscript.targets.godot.path).split(
    "\n",
  );
  let section = null;
  let current = null;

  const flush = () => {
    if (current) fields.push(current);
    current = null;
  };

  for (const line of lines) {
    const sectionMatch = line.match(/^class (Query|Mutation):$/);
    if (sectionMatch) {
      flush();
      section = sectionMatch[1];
      continue;
    }

    if (/^class /.test(line)) {
      flush();
      section = null;
      continue;
    }

    if (!section) continue;

    const fieldMatch = line.match(/^\tclass ([A-Za-z0-9_]+)Field:$/);
    if (fieldMatch) {
      flush();
      current = {
        section,
        className: fieldMatch[1],
        name: "",
        snakeName: "",
        returnType: "",
        isArray: false,
      };
      continue;
    }

    if (!current) continue;

    const stringConstMatch = line.match(
      /^\t\tconst (name|snake_name|return_type) = "([^"]+)"$/,
    );
    if (stringConstMatch) {
      if (stringConstMatch[1] === "name") current.name = stringConstMatch[2];
      if (stringConstMatch[1] === "snake_name")
        current.snakeName = stringConstMatch[2];
      if (stringConstMatch[1] === "return_type")
        current.returnType = stringConstMatch[2];
      continue;
    }

    const isArrayMatch = line.match(/^\t\tconst is_array = (true|false)$/);
    if (isArrayMatch) current.isArray = isArrayMatch[1] === "true";
  }

  flush();
  return fields;
}

function parseGodotWrapperFunctions() {
  const functions = new Map();
  const source = read("libraries/godot-iap/addons/godot-iap/godot_iap.gd");
  for (const match of source.matchAll(
    /^func\s+([A-Za-z_][A-Za-z0-9_]*)\([^)]*\)\s*(?:->\s*([^:]+))?:/gm,
  )) {
    functions.set(match[1], (match[2] ?? "").trim());
  }
  return functions;
}

function expectedGodotReturnAnnotation(field) {
  if (field.isArray) return "Array";
  if (field.returnType === "Boolean") return "bool";
  if (field.returnType === "String") return "String";
  if (field.returnType === "Int") return "int";
  if (field.returnType === "Float") return "float";
  return "Variant";
}

function checkFrameworkOperationBindings() {
  for (const kind of ["Query", "Mutation"]) {
    expectTypeScriptFieldBindings(
      `React Native ${kind}`,
      ["libraries/react-native-iap/src/index.ts"],
      kind,
    );
    expectTypeScriptFieldBindings(
      `Expo ${kind}`,
      [
        "libraries/expo-iap/src/index.ts",
        "libraries/expo-iap/src/modules/android.ts",
        "libraries/expo-iap/src/modules/ios.ts",
      ],
      kind,
    );
  }

  const flutter = read(
    "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
  );
  expectFlutterHandlers(
    "Query",
    extractBetween(
      flutter,
      "gentype.QueryHandlers get queryHandlers",
      "gentype.MutationLaunchExternalLinkAndroidHandler",
    ),
  );
  expectFlutterHandlers(
    "Mutation",
    extractBetween(
      flutter,
      "gentype.MutationHandlers get mutationHandlers",
      "gentype.SubscriptionHandlers get subscriptionHandlers",
    ),
  );
  expectFlutterHandlers(
    "Subscription",
    extractBetween(
      flutter,
      "gentype.SubscriptionHandlers get subscriptionHandlers",
      "\n}",
    ),
  );

  const godotFunctions = parseGodotWrapperFunctions();
  for (const field of parseGodotOperationFields()) {
    if (field.name === "_placeholder") continue;
    const actual = godotFunctions.get(field.snakeName);
    if (!actual) {
      fail(
        `Godot wrapper missing generated ${field.section} operation ${field.name} (${field.snakeName})`,
      );
      continue;
    }

    if (field.snakeName === "fetch_products" && actual === "Array") {
      continue;
    }

    const expected = expectedGodotReturnAnnotation(field);
    if (expected === "Array") {
      if (!actual.startsWith("Array")) {
        fail(
          `Godot wrapper ${field.snakeName} should return Array for ${
            field.returnType
          }, got ${actual || "(none)"}`,
        );
      }
    } else if (actual !== expected) {
      fail(
        `Godot wrapper ${field.snakeName} should return ${expected} for ${
          field.returnType
        }, got ${actual || "(none)"}`,
      );
    }
  }
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
    const lines = text.split("\n");
    let lastFileAnnotation = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("@file:")) lastFileAnnotation = i;
    }
    if (lastFileAnnotation >= 0) {
      lines.splice(
        lastFileAnnotation + 1,
        0,
        "",
        "package io.github.hyochan.kmpiap.openiap",
      );
    } else {
      lines.unshift("package io.github.hyochan.kmpiap.openiap", "");
    }
    text = lines.join("\n");
  }

  return text.replace(
    /(\n\s*\w+\([^)]*\))\n\n(\s+companion object)/g,
    "$1;\n\n$2",
  );
}

function checkLibraryCoverageRegistry() {
  const discovered = listDirectories("libraries");
  for (const library of discovered) {
    if (
      parityCoveredLibraries.has(library) ||
      parityExcludedLibraries.has(library)
    ) {
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
  expectSameSet("Expo example route", discoverExpoRoutes(), routes);
  if (requiredIds.length === 0) {
    fail("Expo example product ID registry is empty");
  }
}

function checkE2eExampleIds() {
  const workflowPath = ".claude/commands/e2e-tests.md";
  const workflow = read(workflowPath);
  const expoSection = extractBetween(
    workflow,
    "## Expo Checks",
    "## React Native Checks",
  );
  const normalTargets = extractBetween(
    expoSection,
    "Example tests, normal Android build, and launch smoke:",
    "VegaOS/Kepler path:",
  );
  const vegaTarget = extractBetween(expoSection, "VegaOS/Kepler path:", null);

  for (const expected of [
    "shell monkey -p dev.hyo.martie 1",
    "dev.hyo.martie",
    "-workspace ios/ExpoIAPExample.xcworkspace",
    "-scheme ExpoIAPExample",
    "Debug-iphoneos/ExpoIAPExample.app",
  ]) {
    if (!normalTargets.includes(expected)) {
      fail(`Expo E2E normal targets are missing ${JSON.stringify(expected)}`);
    }
  }
  if (normalTargets.includes("dev.hyo.openiap.expo.example")) {
    fail(
      "Expo E2E normal targets must use dev.hyo.martie, not the Vega package ID",
    );
  }
  for (const staleName of [
    "ios/expoiapexample.xcworkspace",
    "-scheme expoiapexample",
    "Debug-iphoneos/expoiapexample.app",
  ]) {
    if (normalTargets.includes(staleName)) {
      fail(
        `Expo E2E normal targets must not use stale Xcode name ${JSON.stringify(
          staleName,
        )}`,
      );
    }
  }
  for (const expected of [
    "dev.hyo.openiap.expo.example.main",
    "bun run run:vega:firetv",
  ]) {
    if (!vegaTarget.includes(expected)) {
      fail(`Expo E2E Vega target is missing ${JSON.stringify(expected)}`);
    }
  }

  const mauiSection = extractBetween(
    workflow,
    "## MAUI Checks",
    "## Godot Checks",
  );
  for (const expected of [
    "-p:EmbedAssembliesIntoApk=true",
    'adb -s "$ANDROID_SERIAL" uninstall dev.hyo.martie',
    'adb -s "$ANDROID_SERIAL" install --no-incremental -r',
    'adb -s "$ANDROID_SERIAL" shell monkey -p dev.hyo.martie 1',
    'adb -s "$FIREOS_SERIAL" uninstall dev.hyo.martie',
    'adb -s "$FIREOS_SERIAL" install --no-incremental -r',
    "bin/stores/amazon/Debug/net10.0-android/dev.hyo.martie-Signed.apk",
    'adb -s "$FIREOS_SERIAL" shell monkey -p dev.hyo.martie 1',
    "-p:RuntimeIdentifier=ios-arm64",
    "bin/Debug/net10.0-ios/ios-arm64/OpenIap.Maui.Example.app",
    "xcrun devicectl device process launch",
  ]) {
    if (!mauiSection.includes(expected)) {
      fail(`MAUI E2E device targets are missing ${JSON.stringify(expected)}`);
    }
  }
  if (/ANDROID_SERIAL="\$[^\"]+"\s+dotnet build/.test(mauiSection)) {
    fail(
      "MAUI E2E must select Android devices with adb -s, not ANDROID_SERIAL",
    );
  }
  if (/dotnet build\s+-t:Run\s+-f net10\.0-ios/.test(mauiSection)) {
    fail("MAUI E2E must build ios-arm64 before installing with devicectl");
  }

  expectIncludes(
    "libraries/godot-iap/Makefile",
    ["@rm -rf $(IOS_EXPORT_DIR)", "@touch $(IOS_EXPORT_DIR)/.gdignore"],
    "Godot iOS export isolation",
  );
  expectIncludes(
    "libraries/godot-iap/scripts/install-hooks.sh",
    [
      'git -C "$PROJECT_ROOT" rev-parse --show-toplevel',
      'if [ "$REPO_ROOT" != "$PROJECT_ROOT" ]',
      'git -C "$PROJECT_ROOT" rev-parse --git-path hooks',
    ],
    "Godot Git hook installation",
  );
  expectNotIncludes(
    "libraries/godot-iap/scripts/install-hooks.sh",
    ['HOOKS_DIR="$PROJECT_ROOT/.git/hooks"'],
    "Godot Git hook installation",
  );
  expectIncludes(
    "libraries/godot-iap/ios-gdextension/Package.swift",
    [".iOS(.v17)"],
    "Godot iOS deployment target",
  );
  expectIncludes(
    "libraries/godot-iap/Example/export_presets.cfg",
    ['application/min_ios_version="17.0"'],
    "Godot example iOS deployment target",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/setup/godot.tsx",
    ["<strong>iOS 17+</strong> target"],
    "Godot docs iOS deployment target",
  );
}

function checkGeneratedTypeSync() {
  for (const drift of collectGeneratedSyncDrift(root)) {
    fail(`generated sync manifest drift: ${drift}`);
  }

  for (const kind of Object.keys(operationParityRegistry)) {
    expectSameSet(
      `Google generated ${kind} operations`,
      parseGeneratedOperations(kind),
      parseKotlinResolverOperations(
        GENERATED_SYNC_MANIFEST.kotlin.targets.google.path,
        kind,
      ),
    );
  }
}

function checkGqlRuntimeExports() {
  const packageJson = JSON.parse(read("packages/gql/package.json"));
  const exports = packageJson.exports ?? {};
  for (const [groupName, definition] of Object.entries(
    GENERATED_SYNC_MANIFEST,
  )) {
    const filePath = definition.source.replace(/^packages\/gql\//, "./");
    if (exports[definition.exportKey] !== filePath) {
      fail(
        `@hyodotdev/openiap-gql ${groupName} export ${definition.exportKey} should point to ${filePath}`,
      );
    }
  }
}

function checkOperationRegistry() {
  for (const [kind, registeredOperations] of Object.entries(
    operationParityRegistry,
  )) {
    expectSameSet(
      `GQL ${kind} operation`,
      parseGeneratedOperations(kind),
      registeredOperations,
    );
  }
}

// packages/google dispatches through hand-written Mutation/Query/Subscription
// handler bundles in each flavor's OpenIapModule.kt — NOT through the
// generated resolver interfaces that checkGeneratedTypeSync() compares. A new
// Android operation regenerates into Types.kt (keeping that check green) while
// its nullable bundle field silently defaults to null, which is exactly the
// "declared but not implemented" gap this audit exists to catch. So compare
// every flavor's bundle argument names against the registry directly.
const GOOGLE_FLAVOR_MODULES = [
  "packages/google/openiap/src/play/java/dev/hyo/openiap/OpenIapModule.kt",
  "packages/google/openiap/src/horizon/java/dev/hyo/openiap/OpenIapModule.kt",
  "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
];

// Kotlin comments and string literals may contain brackets or commas (e.g.
// `// (optional)` or `"a, b"`) that must not affect the structural
// bracket-depth and argument-split scans below. Blank their contents out with
// spaces, preserving indices, so only real code characters are scanned.
function parseHandlerBundleArgumentNames(text, bundleType, relativePath) {
  const source = maskKotlinCommentsAndStrings(text);
  const marker = new RegExp(
    `override val \\w+Handlers: ${bundleType} = ${bundleType}\\(`,
  );
  const match = marker.exec(source);
  if (!match) {
    fail(`${relativePath} is missing an override val ${bundleType} bundle`);
    return [];
  }

  // Walk the balanced bracket span of the constructor call, then collect the
  // top-level `name =` argument names inside it.
  let index = match.index + match[0].length;
  const start = index;
  let depth = 1;
  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") depth -= 1;
    index += 1;
  }
  if (depth !== 0) {
    fail(`${relativePath} has an unbalanced ${bundleType} bundle`);
    return [];
  }
  const block = source.slice(start, index - 1);

  const names = [];
  const pushName = (segment) => {
    const nameMatch = segment.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/);
    if (nameMatch) names.push(nameMatch[1]);
  };
  let level = 0;
  let argStart = 0;
  for (let cursor = 0; cursor < block.length; cursor += 1) {
    const char = block[cursor];
    if (char === "(" || char === "{" || char === "[") level += 1;
    else if (char === ")" || char === "}" || char === "]") level -= 1;
    else if (char === "," && level === 0) {
      pushName(block.slice(argStart, cursor));
      argStart = cursor + 1;
    }
  }
  pushName(block.slice(argStart));
  return names.sort();
}

function checkGoogleFlavorHandlerWiring() {
  const androidRelevantOperations = Object.fromEntries(
    Object.entries(operationParityRegistry).map(([kind, operations]) => [
      kind,
      operations.filter((operation) => !operation.endsWith("IOS")),
    ]),
  );
  for (const relativePath of GOOGLE_FLAVOR_MODULES) {
    expectFile(relativePath);
    if (!exists(relativePath)) continue;
    const text = read(relativePath);
    for (const [kind, expectedOperations] of Object.entries(
      androidRelevantOperations,
    )) {
      expectSameSet(
        `${relativePath} ${kind}Handlers wiring`,
        expectedOperations,
        parseHandlerBundleArgumentNames(text, `${kind}Handlers`, relativePath),
      );
    }
  }
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".gradle" ||
      entry.name === ".dart_tool" ||
      entry.name === "build" ||
      entry.name === "bin" ||
      entry.name === "obj" ||
      entry.name === "Pods" ||
      entry.name === "DerivedData"
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
    "libraries/expo-iap/example",
    "libraries/react-native-iap/example",
    "libraries/flutter_inapp_purchase/example",
    "libraries/kmp-iap/example",
    "libraries/maui-iap/example",
    "packages/apple/Example",
    "packages/google/Example",
  ];
  for (const searchRoot of roots) {
    for (const file of walk(abs(searchRoot))) {
      if (!/\.(tsx?|dart|kt|swift|cs|xaml)$/.test(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("getStorefrontIOS(")) {
        fail(
          `example uses getStorefrontIOS instead of getStorefront: ${path.relative(
            root,
            file,
          )}`,
        );
      }
    }
  }
}

function expectNoApi24ConcurrentKeySets() {
  const listenerSetForEach =
    /\b(?:purchaseUpdateListeners|purchaseErrorListeners|userChoiceBillingListeners|developerProvidedBillingListeners|subscriptionBillingIssueListeners)\.forEach\s*\{/;
  const androidSourceRoots = [
    "packages/google/Example/src",
    "packages/google/openiap/src",
    "libraries/expo-iap/android/src",
    "libraries/flutter_inapp_purchase/android/src",
    "libraries/flutter_inapp_purchase/example/android/app/src",
    "libraries/godot-iap/android/src",
    "libraries/react-native-iap/android/src",
  ];
  for (const searchRoot of androidSourceRoots) {
    for (const file of walk(abs(searchRoot))) {
      if (!/\.(?:java|kt)$/.test(file)) continue;
      const source = fs.readFileSync(file, "utf8");
      if (usesApi24ConcurrentKeySet(source, file.endsWith(".kt"))) {
        fail(
          `Android minSdk 23 source uses the reserved newKeySet identifier ` +
            `(ConcurrentHashMap.newKeySet is API 24+); use ` +
            `Collections.newSetFromMap instead: ${path.relative(root, file)}`,
        );
      }
      if (listenerSetForEach.test(source)) {
        fail(
          `Android minSdk 23 listener sets must use an explicit for loop; ` +
            `Java Set.forEach requires API 24+: ${path.relative(root, file)}`,
        );
      }
    }
  }
}

function checkExpoRouterExample(base, importSource) {
  for (const route of routes) {
    expectFile(rel(base, "app", `${route}.tsx`));
  }
  expectIncludes(
    rel(base, "app/_layout.tsx"),
    routes.map((route) => `name="${route}"`),
    `${base} layout`,
  );
  expectIncludes(
    rel(base, "app/index.tsx"),
    routes.map((route) => `/${route}`),
    `${base} home`,
  );
  expectIncludes(rel(base, "app/index.tsx"), ["getStorefront"], `${base} home`);
  expectIncludes(
    rel(base, "app/alternative-billing.tsx"),
    [
      "isBillingProgramAvailableAndroid",
      "launchExternalLinkAndroid",
      "createBillingProgramReportingDetailsAndroid",
      "enableBillingProgramAndroid",
    ],
    `${base} alternative billing`,
  );
  expectNotIncludes(
    rel(base, "app/alternative-billing.tsx"),
    [
      "checkAlternativeBillingAvailabilityAndroid",
      "createAlternativeBillingTokenAndroid",
    ],
    `${base} alternative billing`,
  );
  expectIncludes(
    rel(base, importSource),
    requiredIds,
    `${base} product constants`,
  );
}

function checkReactNativeClassic() {
  const base = "libraries/react-native-iap/example";
  const screens = {
    AllProducts: "AllProducts",
    PurchaseFlow: "PurchaseFlow",
    SubscriptionFlow: "SubscriptionFlow",
    AvailablePurchases: "AvailablePurchases",
    OfferCode: "OfferCode",
    AlternativeBilling: "AlternativeBilling",
  };
  for (const [route, file] of Object.entries(screens)) {
    expectFile(rel(base, "screens", `${file}.tsx`));
    expectIncludes(
      rel(base, "navigation/index.tsx"),
      [`name="${route}"`],
      `${base} navigation`,
    );
  }
  expectIncludes(
    rel(base, "screens/Home.tsx"),
    [
      "All Products",
      "Purchase Flow",
      "Subscription Flow",
      "Available Purchases",
      "Offer Code",
      "Alternative Billing",
    ],
    `${base} home`,
  );
  expectIncludes(
    rel(base, "screens/AlternativeBilling.tsx"),
    [
      "isBillingProgramAvailableAndroid",
      "launchExternalLinkAndroid",
      "createBillingProgramReportingDetailsAndroid",
      "enableBillingProgramAndroid",
    ],
    `${base} alternative billing`,
  );
  expectIncludes(
    rel(base, "src/utils/constants.ts"),
    requiredIds,
    `${base} product constants`,
  );
  expectIncludes(
    rel(base, "__tests__/screens/Home.test.tsx"),
    ["All Products", "Alternative Billing"],
    `${base} home tests`,
  );
  expectIncludes(
    rel(base, "__tests__/RnIap.test.tsx"),
    [
      "getStorefront",
      "isBillingProgramAvailableAndroid",
      "launchExternalLinkAndroid",
      "createBillingProgramReportingDetailsAndroid",
    ],
    `${base} API tests`,
  );
}

function checkFlutter() {
  const base = "libraries/flutter_inapp_purchase/example";
  const screenFiles = [
    "all_products_screen.dart",
    "purchase_flow_screen.dart",
    "subscription_flow_screen.dart",
    "available_purchases_screen.dart",
    "offer_code_screen.dart",
    "alternative_billing_screen.dart",
  ];
  for (const file of screenFiles) {
    expectFile(rel(base, "lib/src/screens", file));
  }
  expectIncludes(
    rel(base, "lib/src/app.dart"),
    routes.map((route) => `/${route}`),
    `${base} routes`,
  );
  expectIncludes(
    rel(base, "lib/src/screens/home_screen.dart"),
    [
      "All Products",
      "Purchase Flow",
      "Subscription Flow",
      "Available Purchases",
      "Redeem Offer Code",
      "Alternative Billing",
    ],
    `${base} home`,
  );
  expectIncludes(
    rel(base, "lib/src/screens/alternative_billing_screen.dart"),
    [
      "isBillingProgramAvailableAndroid",
      "launchExternalLinkAndroid",
      "createBillingProgramReportingDetailsAndroid",
    ],
    `${base} alternative billing`,
  );
  expectIncludes(
    rel(base, "lib/src/constants.dart"),
    requiredIds,
    `${base} product constants`,
  );
  expectIncludes(
    rel(base, "test/widget_test.dart"),
    ["Alternative Billing"],
    `${base} widget tests`,
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/lib/utils.dart",
    ["compactJWS", "promotionalOfferJWS", "winBackOffer"],
    "Flutter iOS purchase payload",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/test/flutter_inapp_purchase_channel_test.dart",
    [
      "sends advanced iOS subscription purchase fields",
      "one-time-offer-token",
      "uses Apple channel method on iOS",
      "deepLinkToSubscriptionsAndroid",
    ],
    "Flutter requestPurchase tests",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    [
      "invokeMethod('deepLinkToSubscriptions')",
      "deepLinkToSubscriptionsAndroid",
    ],
    "Flutter deepLinkToSubscriptions bridge",
  );
  const flutterIosPlugin =
    "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift";
  const flutterMacosPlugin =
    "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift";
  const flutterSwiftPackagePaths = [
    "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Package.swift",
    "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Package.swift",
  ];

  for (const flutterSwiftPackage of flutterSwiftPackagePaths) {
    expectFile(flutterSwiftPackage);
    if (!exists(flutterSwiftPackage)) continue;
    const flutterSwiftPackageText = read(flutterSwiftPackage);
    const openIapDependencyVersion = flutterSwiftPackageText.match(
      /\.package\(url: "https:\/\/github\.com\/hyodotdev\/openiap\.git", from: "([^"]+)"\),/,
    )?.[1];
    if (!openIapDependencyVersion) {
      fail(`${flutterSwiftPackage} is missing the OpenIAP SwiftPM dependency`);
    } else if (
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
        openIapDependencyVersion,
      )
    ) {
      fail(`${flutterSwiftPackage} OpenIAP dependency version must be semver`);
    } else if (openIapDependencyVersion !== "3.0.0") {
      fail(
        `${flutterSwiftPackage} OpenIAP dependency floor must be 3.0.0 for Flutter 10`,
      );
    }
    if (
      !flutterSwiftPackageText.includes(
        '.product(name: "OpenIAP", package: "OpenIAP")',
      )
    ) {
      fail(`${flutterSwiftPackage} is missing the OpenIAP product dependency`);
    }
  }

  expectIncludes(
    flutterIosPlugin,
    [
      'case "deepLinkToSubscriptions"',
      "OpenIapModule.shared.deepLinkToSubscriptions(nil)",
    ],
    "Flutter iOS deepLinkToSubscriptions bridge",
  );
  for (const nativePlugin of [flutterIosPlugin, flutterMacosPlugin]) {
    expectIncludes(
      nativePlugin,
      [
        "private func purchaseErrorDetails(",
        "private func flutterError(",
        "var details = OpenIapSerialization.encode(error)",
        "let compacted = self.purchaseErrorDetails(error)",
        "details: purchaseErrorDetails(error, fallbackProductId: fallbackProductId)",
      ],
      "Flutter Apple PurchaseError diagnostic bridge",
    );
    expectNotIncludes(
      nativePlugin,
      ["details: purchaseError.productId", '"productId": error.productId'],
      "Flutter Apple PurchaseError diagnostics must remain structured",
    );
  }
  expectIncludes(
    flutterMacosPlugin,
    [
      'case "setPurchaseUpdatedListenerOptions"',
      'case "deepLinkToSubscriptions"',
      'case "getAllTransactionsIOS"',
      'case "verifyPurchase"',
      'case "verifyPurchaseWithProvider"',
      'case "isEligibleForExternalPurchaseCustomLinkIOS"',
      'case "getExternalPurchaseCustomLinkTokenIOS"',
      'case "showExternalPurchaseCustomLinkNoticeIOS"',
      "subscriptionBillingIssueListener",
    ],
    "Flutter macOS channel parity",
  );
  const flutterMacosSupportedMethods = [
    "syncIOS",
    "isEligibleForIntroOfferIOS",
    "subscriptionStatusIOS",
    "clearTransactionIOS",
    "getPendingTransactionsIOS",
    "getAllTransactionsIOS",
    "getAppTransactionIOS",
    "currentEntitlementIOS",
    "latestTransactionIOS",
    "isTransactionVerifiedIOS",
    "getTransactionJwsIOS",
    "getReceiptDataIOS",
    "getStorefront",
    "canPresentExternalPurchaseNoticeIOS",
    "presentExternalPurchaseNoticeSheetIOS",
    "isEligibleForExternalPurchaseCustomLinkIOS",
    "getExternalPurchaseCustomLinkTokenIOS",
    "showExternalPurchaseCustomLinkNoticeIOS",
  ];
  for (const method of flutterMacosSupportedMethods) {
    expectIncludes(
      flutterMacosPlugin,
      [
        `case "${method}"`,
        `private func ${method}(`,
        `OpenIapModule.shared.${method}(`,
      ],
      `Flutter macOS ${method} bridge`,
    );
  }
  expectIncludes(
    "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
    ['"setPurchaseUpdatedListenerOptions" ->'],
    "Flutter Android purchase listener option no-op",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/android/build.gradle",
    ["com.android.billingclient:billing-ktx:"],
    "Flutter Android must inherit Play Billing from openiap-google",
  );
  for (const nativePlugin of [
    "libraries/expo-iap/ios/ExpoIapModule.swift",
    flutterIosPlugin,
    flutterMacosPlugin,
  ]) {
    expectNotIncludes(
      nativePlugin,
      [
        "OpenIapModule.shared.validateReceiptIOS",
        "OpenIapModule.shared.getStorefrontIOS()",
      ],
      "Flutter deprecated native OpenIAP calls",
    );
  }
  expectIncludes(
    "libraries/react-native-iap/ios/HybridRnIap.swift",
    ["throw OpenIapException.from(purchaseError)"],
    "RN iOS purchase error bridge",
  );
  expectIncludes(
    "libraries/expo-iap/ios/ExpoIapModule.swift",
    [
      "throw IapException.from(error)",
      "code: .purchaseVerificationFailed",
      "try await OpenIapModule.shared.getStorefront()",
    ],
    "Expo iOS error/storefront bridge",
  );
  expectIncludes(
    "libraries/expo-iap/ios/onside/OnsideIapModule.swift",
    [
      'AsyncFunction("setPurchaseUpdatedListenerOptions")',
      'AsyncFunction("getAvailableItems") { (alsoPublish: Bool, onlyIncludeActive: Bool)',
      'AsyncFunction("getStorefront")',
      "getOnsideStorefront()",
      "OnsideEvent.subscriptionBillingIssue.rawValue",
      'constants["ERROR_CODES"] = errorCodes',
      "switch request.type ?? .inApp",
      "return product.subscriptionPeriod != nil",
      'dictionary["type"] = isSubscription ? "subs" : "in-app"',
      'dictionary["environmentIOS"] = NSNull()',
    ],
    "Expo Onside root API bridge",
  );
  expectNotIncludes(
    "libraries/expo-iap/ios/onside/OnsideIapModule.swift",
    [
      "private let encoder: JSONEncoder",
      'dictionary["environmentIOS"] = transaction.storefront.id',
    ],
    "Expo Onside unused encoder cleanup",
  );
  expectMatch(
    "libraries/expo-iap/ios/onside/OnsideIapModule.swift",
    /switch request\.type \?\? \.inApp\s*\{\s*case \.subs:\s*return product\.subscriptionPeriod != nil\s*case \.inApp:\s*return product\.subscriptionPeriod == nil\s*case \.all:\s*return true\s*\}/,
    "Expo Onside product query type filter",
  );
  expectIncludes(
    "libraries/expo-iap/ios/ExpoIapHelper.swift",
    ["else {\n            return .inApp"],
    "Expo iOS ProductRequest default",
  );
  expectIncludes(
    "libraries/expo-iap/src/index.ts",
    ["restorePurchasesIOSNative"],
    "Expo restore helper routing",
  );
  expectIncludes(
    "libraries/expo-iap/src/utils/restorePurchases.ts",
    ["nativeModule.USING_ONSIDE_SDK", "nativeModule.restorePurchases"],
    "Expo Onside restore routing",
  );
  expectNotIncludes(
    "libraries/expo-iap/src/utils/restorePurchases.ts",
    ["catch(() => undefined)"],
    "Expo restore failures must remain observable",
  );
  expectIncludes(
    "libraries/expo-iap/android/src/main/java/expo/modules/iap/ExpoIapModule.kt",
    [
      "deliverPurchaseRequestFailure(",
      "isCancellation = e is CancellationException",
      "reachedOpenIapRequest = reachedOpenIapRequest",
      "ExpoIapHelper.rejectPurchasePromises(code, message, null)",
    ],
    "Expo Android purchase failures must settle pending promises",
  );
  expectMatch(
    "libraries/react-native-iap/android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt",
    /openIap\.requestPurchase\(requestProps\)[\s\S]*?catch \(e: CancellationException\) \{\s*throw e\s*\}[\s\S]*?catch \(e: Exception\)/,
    "RN Android purchase coroutine cancellation propagation",
  );
  expectIncludes(
    "libraries/expo-iap/src/ExpoIapModule.ts",
    [
      "const ONSIDE_MARKETPLACE_ID = 'com.onside.marketplace-app'",
      "shouldUseOnsideModule()",
      "onsideModuleUnavailable",
      "The call was not routed through Apple StoreKit.",
    ],
    "Expo Onside native module proxy routing",
  );
  expectNotIncludes(
    "libraries/expo-iap/src/ExpoIapModule.ts",
    ["getExpoIapFallbackModule", "expoIapFallback"],
    "Expo Onside must not silently route unsupported operations through Apple StoreKit",
  );
  expectMatch(
    "libraries/expo-iap/src/ExpoIapModule.ts",
    /if\s*\(\s*value !== undefined \|\| resolved\.name !== ['"]ExpoIapOnside['"]\s*\)\s*\{\s*return value;\s*\}\s*return \(\) => \{\s*throw new UnavailabilityError\(/,
    "Expo Onside missing methods must fail closed",
  );
  expectNoMatch(
    "libraries/expo-iap/src/ExpoIapModule.ts",
    /requireNativeModule\(\s*['"]ExpoIap['"]\s*\)\s*\[\s*prop\s*\]/,
    "Expo Onside missing methods must not fall back to Apple StoreKit",
  );
  const expoModulePath = "libraries/expo-iap/src/ExpoIapModule.ts";
  const expoModuleSource = read(expoModulePath);
  const onsideBranch = extractBalancedAfterMarker(
    expoModuleSource,
    "if (shouldUseOnsideModule())",
    "{",
    "}",
    `${expoModulePath} Onside selection branch`,
    maskTypeScriptCommentsAndStrings,
  );
  if (onsideBranch) {
    if (
      /requireNativeModule\(\s*['"]ExpoIap['"]\s*\)|name\s*:\s*['"]ExpoIap['"]/.test(
        onsideBranch.body,
      )
    ) {
      fail(
        `${expoModulePath} Onside selection branch must never return the Apple StoreKit module`,
      );
    }
    const missingModuleCatch = extractBalancedAfterMarker(
      onsideBranch.body,
      "catch (error)",
      "{",
      "}",
      `${expoModulePath} Onside missing-module catch`,
      maskTypeScriptCommentsAndStrings,
    );
    if (missingModuleCatch) {
      const maskedCatch = maskTypeScriptCommentsAndStrings(
        missingModuleCatch.body,
      );
      if (
        /\breturn\b/.test(maskedCatch) ||
        !/onsideModuleUnavailable\s*=\s*true\s*;\s*throw new UnavailabilityError\s*\(/.test(
          maskedCatch,
        )
      ) {
        fail(
          `${expoModulePath} missing Onside module must mark unavailable and throw without fallback`,
        );
      }
    }
  }
  expectIncludes(
    "libraries/expo-iap/src/__tests__/ExpoIapModule.test.ts",
    [
      "re-resolves when Onside availability changes after initial access",
      "fails closed without repeatedly loading a missing ExpoIapOnside module",
      "fails closed for methods missing from ExpoIapOnside",
    ],
    "Expo Onside module proxy tests",
  );
  expectNotIncludes(
    "libraries/expo-iap/src/index.ts",
    ["v3.1.0", "Unsupported Platform", "Platform not supported"],
    "Expo public API warnings/errors must stay current and consistently phrased",
  );
  expectNotIncludes(
    "libraries/expo-iap/CLAUDE.md",
    ["v2.9.0"],
    "Expo package guidance must not reference past deprecation deadlines",
  );
  expectIncludes(
    "libraries/react-native-iap/src/__tests__/index.test.ts",
    ["deepLinkToSubscriptions surfaces iOS native failures"],
    "RN deepLinkToSubscriptions error tests",
  );
  expectNotIncludes(
    "libraries/react-native-iap/src/index.ts",
    [
      "RnIapConsole.warn('[deepLinkToSubscriptions] Failed on iOS:'",
      "getActiveSubscriptions_OLD",
      "v14.4.0",
    ],
    "RN deepLinkToSubscriptions error handling",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    ["final androidProps = type == 'inapp'"],
    "Flutter Android requestPurchase parser",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
    [
      '"Invalid developerBillingOption: ${e.message}"',
      '"Invalid subscriptionProductReplacementParams: ${e.message}"',
      '"oldProductId and replacementMode are required"',
    ],
    "Flutter Android billing option validation",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
    [
      'OpenIapLog.w(TAG, "Failed to parse developerBillingOption:',
      'OpenIapLog.w(TAG, "Failed to parse subscriptionProductReplacementParams:',
    ],
    "Flutter Android billing option validation must not silently fall back",
  );
}

function checkKmp() {
  const base = "libraries/kmp-iap/example/composeApp/src";
  for (const file of [
    "AllProductsScreen.kt",
    "PurchaseFlowScreen.kt",
    "SubscriptionFlowScreen.kt",
    "AvailablePurchasesScreen.kt",
    "OfferCodeScreen.kt",
    "AlternativeBillingScreen.kt",
    "ExampleProductIds.kt",
  ]) {
    expectFile(rel(base, "commonMain/kotlin/dev/hyo/martie/screens", file));
  }
  expectIncludes(
    rel(base, "commonMain/kotlin/dev/hyo/martie/navigation/Navigation.kt"),
    routes,
    "KMP navigation",
  );
  expectIncludes(
    rel(base, "commonMain/kotlin/dev/hyo/martie/screens/HomeScreen.kt"),
    [
      "All Products",
      "Purchase Flow",
      "Subscription Flow",
      "Available Purchases",
      "Offer Code",
      "Alternative Billing",
      "getStorefront()",
    ],
    "KMP home",
  );
  expectIncludes(
    rel(
      base,
      "commonMain/kotlin/dev/hyo/martie/screens/AlternativeBillingScreen.kt",
    ),
    [
      "isBillingProgramAvailableAndroid",
      "launchExternalLinkAndroid",
      "createBillingProgramReportingDetailsAndroid",
    ],
    "KMP alternative billing",
  );
  expectIncludes(
    rel(base, "commonMain/kotlin/dev/hyo/martie/screens/ExampleProductIds.kt"),
    requiredIds,
    "KMP product constants",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt",
    [
      "requestPurchaseWithPayload(params.toJson().toObjCMap())",
      "requireIosSku(params)",
      "openIapModule.verifyPurchaseWithSku(sku)",
      "decodeActiveSubscriptionListPayloadIOS(result, subscriptionIds)",
    ],
    "KMP iOS requestPurchase bridge",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt",
    [`${TODO_MARKER}: iOS 15+/18+ options`, "For now, return a basic result"],
    "KMP iOS requestPurchase bridge",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt",
    ["requestPurchaseOnPromotedProductIOS(): Boolean = false"],
    "KMP Android promoted product bridge",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt",
    [
      "val requestedProductIds = params.skus.distinct()",
      "return awaitBillingQuery(",
      "client.queryProductDetailsAsync(queryParams)",
      "complete(Result.failure(PurchaseException(error)))",
    ],
    "KMP fresh, fail-closed product query",
  );
  expectIncludes(
    "libraries/kmp-iap/example/gradle.properties",
    ["kotlin.apple.xcodeCompatibility.nowarn=true"],
    "KMP example Xcode compatibility warning suppression",
  );
}

function checkApple() {
  const base = "packages/apple";
  for (const file of [
    "AllProductsView.swift",
    "PurchaseFlowScreen.swift",
    "SubscriptionFlowScreen.swift",
    "AvailablePurchasesScreen.swift",
    "OfferCodeScreen.swift",
    "AlternativeBillingScreen.swift",
  ]) {
    expectFile(rel(base, "Example/OpenIapExample/Screens", file));
  }
  expectIncludes(
    rel(base, "Example/OpenIapExample/Screens/HomeScreen.swift"),
    [
      "AllProductsView",
      "PurchaseFlowScreen",
      "SubscriptionFlowScreen",
      "AvailablePurchasesScreen",
      "OfferCodeScreen",
      "AlternativeBillingScreen",
    ],
    "Apple home",
  );
  expectIncludes(
    rel(base, "Sources/OpenIapProtocol.swift"),
    [
      "func getStorefront()",
      "func canPresentExternalPurchaseNoticeIOS()",
      "func presentExternalPurchaseNoticeSheetIOS()",
      "func presentExternalPurchaseLinkIOS",
      "func isEligibleForExternalPurchaseCustomLinkIOS()",
      "func getExternalPurchaseCustomLinkTokenIOS",
      "func showExternalPurchaseCustomLinkNoticeIOS",
    ],
    "Apple protocol",
  );
  expectIncludes(
    rel(base, "Sources/OpenIapStore.swift"),
    [
      "func getStorefront()",
      "deinit {",
      "module.removeListener(token)",
      "guard listenerTokens.isEmpty else { return }",
      "func canPresentExternalPurchaseNoticeIOS()",
      "func presentExternalPurchaseNoticeSheetIOS()",
      "func presentExternalPurchaseLinkIOS",
      "func isEligibleForExternalPurchaseCustomLinkIOS()",
      "func getExternalPurchaseCustomLinkTokenIOS",
      "func showExternalPurchaseCustomLinkNoticeIOS",
    ],
    "Apple store",
  );
  expectIncludes(
    rel(base, "Sources/OpenIapModule+ObjC.swift"),
    [
      "func requestPurchaseWithPayload",
      "OpenIapSerialization.requestPurchaseProps(from: payload)",
      "func getStorefrontWithCompletion",
    ],
    "Apple ObjC purchase bridge",
  );
  expectIncludes(
    rel(base, "Tests/OpenIapTests/VerifyPurchaseTests.swift"),
    ["testStorefrontUsesUnifiedProtocolMethod", "getStorefrontCallCount"],
    "Apple tests",
  );
  expectIncludes(
    rel(base, "Example/OpenIapExample/Screens/AllProductsView.swift"),
    requiredIds,
    "Apple product constants",
  );
}

function checkGoogle() {
  const base = "packages/google";
  for (const file of [
    "AllProductsScreen.kt",
    "PurchaseFlowScreen.kt",
    "SubscriptionFlowScreen.kt",
    "AvailablePurchasesScreen.kt",
    "OfferCodeScreen.kt",
    "AlternativeBillingScreen.kt",
  ]) {
    expectFile(rel(base, "Example/src/main/java/dev/hyo/martie/screens", file));
  }
  expectIncludes(
    rel(base, "Example/src/main/java/dev/hyo/martie/screens/HomeScreen.kt"),
    [
      "all_products",
      "purchase_flow",
      "subscription_flow",
      "available_purchases",
      "offer_code",
      "alternative_billing",
    ],
    "Google home",
  );
  for (const flavor of ["play", "horizon", "amazon"]) {
    expectIncludes(
      rel(base, `openiap/src/${flavor}/java/dev/hyo/openiap/OpenIapModule.kt`),
      [
        "getStorefront = { getStorefront() }",
        "createBillingProgramReportingDetailsAndroid",
        "getBillingChoiceInfoAndroid",
        "isBillingProgramAvailableAndroid",
        "launchExternalLinkAndroid",
        "showBillingProgramInformationDialogAndroid",
        "showInAppMessagesAndroid",
      ],
      `Google ${flavor} module handlers`,
    );
  }
  expectIncludes(
    rel(base, "Example/src/main/java/dev/hyo/martie/Constants.kt"),
    requiredIds,
    "Google product constants",
  );
  expectIncludes(
    rel(
      base,
      "openiap/src/test/java/dev/hyo/openiap/BillingProgramAndroidTest.kt",
    ),
    ["external-offer", "external-payments"],
    "Google Billing Programs tests",
  );
}

function checkMaui() {
  const base = "libraries/maui-iap/example/OpenIap.Maui.Example";
  for (const page of [
    "AllProductsPage",
    "PurchaseFlowPage",
    "SubscriptionFlowPage",
    "AvailablePurchasesPage",
    "OfferCodePage",
    "AlternativeBillingPage",
  ]) {
    expectFile(rel(base, "Pages", `${page}.xaml`));
    expectFile(rel(base, "Pages", `${page}.xaml.cs`));
  }
  expectIncludes(
    rel(base, "Pages/HomePage.xaml"),
    [
      "All Products",
      "Purchase Flow",
      "Subscription Flow",
      "Available Purchases",
      "Offer Code",
      "Alternative Billing",
    ],
    "MAUI home",
  );
  expectIncludes(rel(base, "AppShell.xaml.cs"), routes, "MAUI routes");
  expectIncludes(
    rel(base, "Pages/AlternativeBillingPage.xaml.cs"),
    [
      "IsBillingProgramAvailableAndroidAsync",
      "LaunchExternalLinkAndroidAsync",
      "CreateBillingProgramReportingDetailsAndroidAsync",
    ],
    "MAUI alternative billing",
  );
  expectIncludes(
    rel(base, "Constants.cs"),
    requiredIds,
    "MAUI product constants",
  );
  expectIncludes(
    rel(base, "Utils/IapKitSettings.cs"),
    [
      "CreateVerifyProps(Purchase purchase)",
      "BaseUrl = BaseUrl",
      "IapStore.Apple",
      "IapStore.Google",
      "IapStore.Amazon",
      "RequestVerifyPurchaseWithIapkitAmazonProps",
      "UserId = (purchase as PurchaseAndroid)?.UserIdAmazon",
      "ReceiptId = token",
    ],
    "MAUI IAPKit verification must select one store payload and preserve the configured endpoint",
  );
  expectIncludes(
    rel(base, "Platforms/Android/AndroidManifest.xml"),
    ['android:usesCleartextTraffic="true"'],
    "MAUI example Android manifest must allow local IAPKit E2E endpoints",
  );
  expectIncludes(
    rel(base, "Pages/PurchaseFlowPage.xaml.cs"),
    [
      "if (!verificationPassed)",
      "Purchase verification failed; the transaction was not finalized.",
    ],
    "MAUI purchase flow must not finalize purchases that fail verification",
  );
  expectIncludes(
    rel(base, "Pages/SubscriptionFlowPage.xaml.cs"),
    [
      "Task<bool> VerifySubscriptionIfNeededAsync",
      "Subscription verification failed; the transaction was not finalized.",
    ],
    "MAUI subscription flow must not finalize purchases that fail verification",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui.Bindings.iOS/ApiDefinition.cs",
    ["requestPurchaseWithPayload:completion:", "getStorefrontWithCompletion:"],
    "MAUI iOS binding",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/Platforms/iOS/OpenIapIOS.cs",
    [
      "RequestPurchaseWithPayload",
      "RequestPurchasePayload",
      "_module.GetStorefront(cb)",
      "GetActiveSubscriptionsAsync(subscriptionIds)",
    ],
    "MAUI iOS requestPurchase bridge",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/Platforms/iOS/NSObjectJsonBridge.cs",
    ["JsonObjectToDictionary"],
    "MAUI iOS JSON bridge",
  );
  const mauiAndroidPath =
    "libraries/maui-iap/src/OpenIap.Maui/Platforms/Android/OpenIapAndroid.cs";
  for (const [listener, variable, type, eventName] of [
    ["PurchaseUpdated", "purchase", "Purchase", "purchaseUpdated"],
    [
      "SubscriptionBillingIssue",
      "purchase",
      "Purchase",
      "subscriptionBillingIssue",
    ],
    [
      "UserChoiceBillingAndroid",
      "details",
      "UserChoiceBillingDetails",
      "userChoiceBillingAndroid",
    ],
    [
      "DeveloperProvidedBillingAndroid",
      "details",
      "DeveloperProvidedBillingDetailsAndroid",
      "developerProvidedBillingAndroid",
    ],
  ]) {
    expectMatch(
      mauiAndroidPath,
      new RegExp(
        `_module\\.Add${listener}Listener\\(new EventBridge\\(json =>\\s*\\{\\s*var ${variable} = DeserializeListenerPayload<${type}>\\(\\s*json,\\s*"${eventName}"\\s*\\);`,
      ),
      `MAUI Android ${eventName} listener payload bridge`,
    );
  }
  expectMatch(
    mauiAndroidPath,
    /_module\.AddPurchaseErrorListener\(new EventBridge\(json =>\s*\{\s*_purchaseError\.OnNext\(OpenIapErrorMapper\.FromJson\(json\)\);/,
    "MAUI Android purchaseError listener payload bridge",
  );
  expectIncludes(
    mauiAndroidPath,
    [
      "private static T? DeserializeListenerPayload<T>",
      "ReportListenerFailure(listenerName, ex)",
      "Do not include the raw payload",
    ],
    "MAUI Android listener failure visibility",
  );
}

function checkNativeApis() {
  expectIncludes(
    "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
    [
      "getStorefront(): Promise<string>",
      "isBillingProgramAvailableAndroid",
      "createBillingProgramReportingDetailsAndroid",
      "getBillingChoiceInfoAndroid",
      "launchExternalLinkAndroid",
      "showBillingProgramInformationDialogAndroid",
      "showInAppMessagesAndroid",
    ],
    "RN native spec",
  );
  expectIncludes(
    "libraries/expo-iap/src/index.ts",
    ["getStorefront", "export * from './modules/android';"],
    "Expo API exports",
  );
  expectIncludes(
    "libraries/expo-iap/src/modules/android.ts",
    [
      "getBillingChoiceInfoAndroid",
      "showBillingProgramInformationDialogAndroid",
      "showInAppMessagesAndroid",
    ],
    "Expo Android API exports",
  );
  expectIncludes(
    GENERATED_SYNC_MANIFEST.dart.targets.flutter.path,
    [
      "Future<String> getStorefront()",
      "Future<BillingProgramReportingDetailsAndroid> createBillingProgramReportingDetailsAndroid",
      "Future<BillingChoiceInfoAndroid> getBillingChoiceInfoAndroid",
      "Future<BillingProgramAvailabilityResultAndroid> isBillingProgramAvailableAndroid",
      "Future<bool> launchExternalLinkAndroid",
      "Future<BillingResultAndroid> showBillingProgramInformationDialogAndroid",
      "Future<InAppMessageResultAndroid> showInAppMessagesAndroid",
    ],
    "Flutter generated API",
  );
  expectIncludes(
    GENERATED_SYNC_MANIFEST.kotlin.targets.kmp.path,
    [
      "suspend fun getStorefront(): String",
      "suspend fun createBillingProgramReportingDetailsAndroid",
      "suspend fun getBillingChoiceInfoAndroid",
      "suspend fun isBillingProgramAvailableAndroid",
      "suspend fun launchExternalLinkAndroid",
      "suspend fun showBillingProgramInformationDialogAndroid",
      "suspend fun showInAppMessagesAndroid",
    ],
    "KMP generated API",
  );
}

function checkBillingChoiceFieldBindings() {
  expectIncludes(
    "packages/docs/src/pages/docs/apis/android/show-billing-program-information-dialog-android.tsx",
    [
      "a developer-rendered, in-app flow",
      "Google-rendered and external-link flows do not use this step",
    ],
    "Billing Choice information dialog docs",
  );
  expectNotIncludes(
    "packages/docs/src/pages/docs/apis/android/show-billing-program-information-dialog-android.tsx",
    [
      "for Google-rendered Billing Choice flows",
      "when Google renders the Billing Choice screen",
    ],
    "Billing Choice information dialog docs",
  );
  expectIncludes(
    "libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/AlternativeBillingScreen.kt",
    [
      "BillingChoiceScreenTypeAndroid.DeveloperRendered",
      "DeveloperBillingTypeAndroid.InApp",
      "fun showAndroidBillingMessages()",
    ],
    "KMP Billing Choice example flow",
  );
  expectNotIncludes(
    "libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/AlternativeBillingScreen.kt",
    [
      "val developerBillingType = if (availability.isExternalLinkAvailable == true)",
    ],
    "KMP Billing Choice example flow",
  );
  expectIncludes(
    ".claude/guides/05-google-package.md",
    ["Play Billing 9.1.0", "Horizon SDK 2.0.0", "Amazon Appstore SDK 3.0.9"],
    "Google package guide store versions",
  );
  expectNotIncludes(
    ".claude/guides/05-google-package.md",
    ["Play Billing 8.x"],
    "Google package guide current Play Billing version",
  );
  expectIncludes(
    "packages/docs/src/lib/images.ts",
    ["Play Billing 9.1 coverage"],
    "React Native docs current Play Billing coverage",
  );
  expectNotIncludes(
    "packages/docs/src/lib/images.ts",
    ["Play Billing 8 coverage"],
    "React Native docs stale Play Billing coverage",
  );
  expectNotIncludes(
    "packages/google/ALTERNATIVE_BILLING.md",
    ["this library uses 8.0.0"],
    "Google Play Billing runtime documentation",
  );
  expectIncludes(
    "packages/gql/src/api-android.graphql",
    [
      "OpenIAP availability: Spec 2.1.0 / openiap-google 2.3.0",
      "requires Play Billing 9.1.0+",
    ],
    "Billing Choice OpenIAP-first API availability",
  );
  expectIncludes(
    "packages/gql/src/type-android.graphql",
    [
      "OpenIAP Spec 2.1.0 / openiap-google 2.3.0",
      "upstream API available since Play Billing 4.1.0",
    ],
    "Billing Choice OpenIAP-first type availability",
  );
  expectIncludes(
    ".claude/commands/e2e-tests.md",
    ["cd libraries/react-native-iap", "yarn specs", "yarn lint:tsc"],
    "React Native E2E Nitro generation",
  );
  expectIncludes(
    "packages/google/openiap/src/play/java/dev/hyo/openiap/OpenIapModule.kt",
    [
      "billingChoiceScreenType = config?.billingChoiceScreenTypeAndroid",
      "configuration.billingChoiceScreenType !=",
      "setOriginalExternalTransactionId",
      "params.externalTransactionToken",
      'getMethod("getLinkUri")',
      'getMethod("getOriginalExternalTransactionId")',
      'getMethod("getProducts")',
      'getMethod("getId")',
      'getMethod("getOfferToken")',
      'getMethod("getType")',
      "productDetailsAndroid = productDetails",
      "?.takeIf { it.isNotBlank() }",
      "DeveloperProvidedBillingProductAndroid(",
      "BillingClient.BillingProgram.BILLING_CHOICE",
      "BillingProgramReportingDetailsParams.DeveloperBillingType.IN_APP",
      "InAppMessageParams.InAppMessageCategoryId.TRANSACTIONAL",
      "pendingBillingPrograms",
      "resolveBillingProgramsForConnection(",
    ],
    "Google Billing Choice field bindings",
  );
  expectNotIncludes(
    "packages/google/openiap/src/play/java/dev/hyo/openiap/OpenIapModule.kt",
    ["products.map { it.toString() }"],
    "Google UserChoiceDetails product ID mapping",
  );
  expectIncludes(
    "packages/google/openiap/src/horizon/java/dev/hyo/openiap/OpenIapModule.kt",
    [
      "Meta Horizon does not support Google Play Billing Program reporting details",
      "Meta Horizon does not support Google Play Billing Choice",
      "Meta Horizon does not support Google Play billing in-app messages",
      "throw OpenIapError.MissingCurrentActivity",
    ],
    "Horizon unsupported Google Billing APIs",
  );
  expectNotIncludes(
    "packages/google/openiap/src/horizon/java/dev/hyo/openiap/OpenIapModule.kt",
    [
      'externalTransactionToken = ""',
      "InAppMessageResponseCodeAndroid.NoActionNeeded",
    ],
    "Horizon unsupported Google Billing APIs must not report success",
  );
  expectIncludes(
    "packages/google/openiap/src/play/java/dev/hyo/openiap/utils/BillingResultConverters.kt",
    [
      "onPurchasesUpdatedSubResponseCode.toOpenIapSubResponseCode()",
      "PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS",
      "USER_INELIGIBLE",
    ],
    "Google BillingResult sub-response mapping",
  );
  expectIncludes(
    "packages/google/openiap/src/testPlay/java/dev/hyo/openiap/utils/BillingResultConvertersTest.kt",
    [
      "maps every Play Billing 9_1 sub-response code",
      "unknown sub-response code remains absent",
    ],
    "Google BillingResult sub-response tests",
  );
  expectIncludes(
    "packages/google/openiap/src/main/java/dev/hyo/openiap/helpers/CommonHelpers.kt",
    ["pendingPrograms.filterNot { it == BillingProgramAndroid.Unspecified }"],
    "Google billing-program connection state",
  );
  expectIncludes(
    "packages/google/openiap/src/test/java/dev/hyo/openiap/BillingChoiceAndroidTypesTest.kt",
    ["pre-init billing programs survive connection config reset"],
    "Google Billing Choice connection tests",
  );
  expectNotIncludes(
    "packages/google/openiap/src/main/java/dev/hyo/openiap/OpenIapViewModel.kt",
    [
      "RequestPurchasePropsByPlatforms(android =",
      "RequestSubscriptionPropsByPlatforms(android =",
    ],
    "Google ViewModel must use canonical google request fields",
  );

  expectIncludes(
    "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
    [
      "originalExternalTransactionId?:",
      "developerBillingOption?:",
      "externalTransactionToken?: string | null;",
      "subResponseCode?: SubResponseCodeAndroid | null;",
    ],
    "RN Billing Choice native spec fields",
  );
  expectIncludes(
    "libraries/react-native-iap/android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt",
    [
      "billingChoiceScreenTypeAndroid = configValue.billingChoiceScreenTypeAndroid",
      "developerBillingOption = developerBillingOption",
      "originalExternalTransactionId = androidRequest.originalExternalTransactionId",
      "externalTransactionToken = params.externalTransactionToken.unwrapString()",
      "linkUri = details.linkUri.wrapVariant()",
      "originalExternalTransactionId = details.originalExternalTransactionId.wrapVariant()",
      'getMethod("getOriginalExternalTransactionId")',
      'getMethod("getProductDetailsAndroid")',
      "productDetailsAndroid = productDetails?.map",
      "products = details.products.map",
      "subResponseCode = mapSubResponseCode(result.subResponseCode)",
    ],
    "RN Billing Choice Android bridge fields",
  );
  expectIncludes(
    "libraries/react-native-iap/src/__tests__/index.test.ts",
    [
      "passes developer-rendered Billing Choice config to native",
      "forwards Billing Choice external transaction token",
      "originalExternalTransactionId",
      "'no-applicable-sub-response-code'",
    ],
    "RN Billing Choice bridge tests",
  );
  expectIncludes(
    "libraries/react-native-iap/src/index.ts",
    ["externalTransactionToken: params.externalTransactionToken"],
    "RN Billing Choice public API fields",
  );
  expectIncludes(
    "libraries/react-native-iap/src/hooks/useIAP.ts",
    [
      "billingChoiceScreenTypeAndroid?: BillingChoiceScreenTypeAndroid",
      "developerProvidedBillingListenerAndroid",
      "onDeveloperProvidedBillingAndroid",
      "getBillingChoiceInfoAndroid?: QueryField<'getBillingChoiceInfoAndroid'>",
      "showInAppMessagesAndroid?: MutationField<'showInAppMessagesAndroid'>",
    ],
    "RN Billing Choice hook wiring",
  );
  expectMatch(
    "libraries/react-native-iap/src/hooks/useIAP.ts",
    /const getAvailablePurchasesInternal[\s\S]*?catch \(error\) \{[\s\S]*?invokeOnError\(error\);\s*throw error;[\s\S]*?const getActiveSubscriptionsInternal/,
    "RN authoritative purchase-query hook failure propagation",
  );
  expectMatch(
    "libraries/react-native-iap/src/hooks/useIAP.ts",
    /const getActiveSubscriptionsInternal[\s\S]*?catch \(error\) \{[\s\S]*?invokeOnError\(error\);\s*throw error;[\s\S]*?const hasActiveSubscriptionsInternal[\s\S]*?catch \(error\) \{[\s\S]*?invokeOnError\(error\);\s*throw error;/,
    "RN subscription entitlement hook failure propagation",
  );
  expectMatch(
    "libraries/react-native-iap/src/hooks/useIAP.ts",
    /const restorePurchases[\s\S]*?const synced = await syncIOS\(\);\s*if \(!synced\)[\s\S]*?ErrorCode\.SyncError[\s\S]*?invokeOnError\(error\);\s*throw error;[\s\S]*?await getAvailablePurchasesInternal\(options\);/,
    "RN restore hook failure propagation",
  );
  expectMatch(
    "libraries/react-native-iap/src/index.ts",
    /export const restorePurchases[\s\S]*?const synced = await syncIOS\(\);\s*if \(!synced\)[\s\S]*?ErrorCode\.SyncError[\s\S]*?await getAvailablePurchases/,
    "RN restore API false-sync rejection",
  );
  expectIncludes(
    "libraries/react-native-iap/src/index.ts",
    [
      "return convertApplePurchasesOrThrow(nitroPurchases);",
      "return convertAndroidPurchasesOrThrow(allNitroPurchases);",
    ],
    "RN platform-scoped authoritative purchase-list decoding",
  );
  expectIncludes(
    "libraries/react-native-iap/src/vega-adapter.ts",
    [
      "throw malformedVegaResponse(error, 'Amazon Vega purchase updates')",
      "'Amazon Vega purchase product metadata'",
      "ErrorCode.BillingResponseJsonParseError",
    ],
    "RN Vega authoritative purchase-query failure propagation",
  );
  expectIncludes(
    "libraries/expo-iap/src/vega-adapter.ts",
    [
      "throw malformedVegaResponse(error, 'Amazon Vega purchase updates')",
      "'Amazon Vega purchase product metadata'",
      "ErrorCode.BillingResponseJsonParseError",
    ],
    "Expo Vega authoritative purchase-query failure propagation",
  );
  expectIncludes(
    "libraries/expo-iap/src/modules/ios.ts",
    [
      "return decodeApplePurchases(purchases);",
      "return decodeApplePurchases(transactions);",
    ],
    "Expo authoritative StoreKit list decoding",
  );
  expectIncludes(
    "libraries/expo-iap/src/index.ts",
    [
      "? decodeApplePurchases(purchases)",
      ": decodeAndroidPurchases(purchases);",
    ],
    "Expo platform-scoped authoritative purchase-list decoding",
  );
  expectMatch(
    "libraries/expo-iap/src/useIAP.ts",
    /const getActiveSubscriptionsInternal[\s\S]*?invokeOnError\(error\);\s*throw error;[\s\S]*?const hasActiveSubscriptionsInternal[\s\S]*?invokeOnError\(error\);\s*throw error;/,
    "Expo subscription entitlement hook failure propagation",
  );
  expectMatch(
    "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    /showManageSubscriptionsIOS[\s\S]*?rejectMalformed: true[\s\S]*?get getPendingTransactionsIOS[\s\S]*?rejectMalformed: true[\s\S]*?get getAllTransactionsIOS[\s\S]*?rejectMalformed: true/,
    "Flutter authoritative StoreKit list decoding",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/lib/helpers.dart",
    [
      "if (platformIsIOS && store != 'apple') return false;",
      "store != 'google' &&",
      "store != 'amazon' &&",
      "store != 'horizon'",
    ],
    "Flutter platform-scoped authoritative purchase-list decoding",
  );
  expectIncludes(
    "libraries/react-native-iap/src/__tests__/hooks/useIAP.android.test.ts",
    [
      "passes the Billing Choice renderer to initConnection on Android",
      "forwards developer-provided Billing Choice events from the hook",
      "exposes all Billing Choice APIs through the hook",
    ],
    "RN Billing Choice hook tests",
  );

  expectIncludes(
    "libraries/expo-iap/android/src/main/java/expo/modules/iap/ExpoIapModule.kt",
    [
      "InitConnectionConfig.fromJson(it)",
      "developerBillingOption = parsedParams.developerBillingOption",
      "originalExternalTransactionId = parsedParams.originalExternalTransactionId",
      "externalTransactionToken = externalTransactionToken",
      "promise.resolve(result.toJson())",
    ],
    "Expo Billing Choice Android bridge fields",
  );
  expectIncludes(
    "libraries/expo-iap/android/src/main/java/expo/modules/iap/ExpoIapHelper.kt",
    ["eventDeveloperProvidedBilling", "details.toJson()"],
    "Expo Billing Choice event payload",
  );
  expectIncludes(
    "libraries/expo-iap/src/__tests__/index.test.ts",
    [
      "forwards developer-rendered Billing Choice connection config",
      "originalExternalTransactionId",
    ],
    "Expo Billing Choice public API tests",
  );
  expectIncludes(
    "libraries/expo-iap/src/modules/__tests__/android.test.ts",
    [
      "forwards the Billing Choice external transaction token",
      "subResponseCode: 'no-applicable-sub-response-code'",
    ],
    "Expo Billing Choice Android API tests",
  );
  expectIncludes(
    "libraries/expo-iap/src/useIAP.ts",
    [
      "enableBillingProgramAndroid?: BillingProgramAndroid",
      "billingChoiceScreenTypeAndroid?: BillingChoiceScreenTypeAndroid",
      "developerProvidedBillingListenerAndroid",
      "subscriptionBillingIssueListener",
      "getBillingChoiceInfoAndroid: QueryField<'getBillingChoiceInfoAndroid'>",
      "showInAppMessagesAndroid: MutationField<'showInAppMessagesAndroid'>",
    ],
    "Expo Billing Choice hook wiring",
  );
  expectIncludes(
    "libraries/expo-iap/src/__tests__/useIAP.test.tsx",
    [
      "forwards renderer config and billing event callbacks",
      "exposes all Billing Choice APIs through the hook",
    ],
    "Expo Billing Choice hook tests",
  );

  expectIncludes(
    "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    [
      "billingChoiceScreenTypeAndroid",
      "payload['originalExternalTransactionId']",
      "payload['developerBillingOption']",
      "'externalTransactionToken': params.externalTransactionToken",
    ],
    "Flutter Billing Choice Dart bridge fields",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
    [
      'configMap["billingChoiceScreenTypeAndroid"]',
      "originalExternalTransactionId = originalExternalTransactionId",
      "developerBillingOption = developerBillingOption",
      "externalTransactionToken = externalTransactionToken",
      'put("subResponseCode", result.subResponseCode?.toJson())',
    ],
    "Flutter Billing Choice Android bridge fields",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/test/flutter_inapp_purchase_channel_test.dart",
    [
      "BillingChoiceScreenTypeAndroid.DeveloperRendered",
      "'originalExternalTransactionId'",
      "'externalTransactionToken'",
      "details.products.single.id",
      "SubResponseCodeAndroid.NoApplicableSubResponseCode",
    ],
    "Flutter Billing Choice channel tests",
  );

  expectIncludes(
    "libraries/godot-iap/addons/godot-iap/godot_iap.gd",
    [
      "func get_billing_choice_info_android(params) -> Variant:",
      "func show_billing_program_information_dialog_android(params) -> Variant:",
      "func show_in_app_messages_android(params = null) -> Variant:",
      "initConnectionWithConfig",
      '"originalExternalTransactionId"',
      '"developerBillingOption"',
      "JSON.stringify(params.to_dict())",
    ],
    "Godot Billing Choice wrapper fields",
  );
  expectIncludes(
    "libraries/godot-iap/android/src/main/java/dev/hyo/godotiap/GodotIap.kt",
    [
      "fun getBillingChoiceInfoAndroid(paramsJson: String): String",
      "fun showBillingProgramInformationDialogAndroid(paramsJson: String): String",
      "fun showInAppMessagesAndroid(paramsJson: String): String",
      "InitConnectionConfig.fromJson(",
      "addDeveloperProvidedBillingListener",
      "originalExternalTransactionId = params.originalExternalTransactionId",
      "externalTransactionToken = externalTransactionToken",
      'emitSignal("developer_provided_billing", JSONObject(details.toJson()).toString())',
      'put("subResponseCode", result.subResponseCode?.toJson())',
    ],
    "Godot Billing Choice Android bridge fields",
  );
  expectNotIncludes(
    "libraries/godot-iap/android/src/main/java/dev/hyo/godotiap/GodotIap.kt",
    [".forEach"],
    "Godot Android bridge collection iteration must remain compatible with API 23",
  );
  expectIncludes(
    "libraries/godot-iap/Example/tests/test_godot_iap.gd",
    [
      "billing_choice_screen_type_android",
      "originalExternalTransactionId",
      "developerBillingOption",
    ],
    "Godot Billing Choice wrapper tests",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/types/billing-programs.tsx",
    ["iap.developer_provided_billing_android.connect"],
    "Godot developer-provided billing docs signal",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/types/alternative-billing-types.tsx",
    ["iap.user_choice_billing_android.connect"],
    "Godot user choice billing docs signal",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/features/external-purchase.tsx",
    ["iap.developer_provided_billing_android.connect"],
    "Godot external purchase docs signal",
  );
  for (const path of [
    "packages/docs/src/pages/docs/types/billing-programs.tsx",
    "packages/docs/src/pages/docs/types/alternative-billing-types.tsx",
    "packages/docs/src/pages/docs/features/external-purchase.tsx",
  ]) {
    expectNotIncludes(
      path,
      [
        "iap.developer_provided_billing.connect",
        "iap.user_choice_billing.connect",
      ],
      "Godot billing docs stale signals",
    );
  }

  expectIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt",
    [
      "val requestedBillingChoiceScreenType = config?.billingChoiceScreenTypeAndroid",
      "includeDeveloperListener =",
      "setOriginalExternalTransactionId",
      "params.externalTransactionToken",
      'invokeOptionalStringGetter("getExternalTransactionToken")',
      'invokeOptionalStringGetter("getLinkUri")',
      'invokeOptionalStringGetter("getOriginalExternalTransactionId")',
      'invokeOptionalListGetter("getProducts")',
      "private fun com.android.billingclient.api.UserChoiceDetails.toOpenIapDetails()",
      "originalExternalTransactionId = originalExternalTransactionId",
      "productDetailsAndroid = productDetails",
      "runCatching { javaClass.getMethod(methodName)",
      "?.takeIf { it.isNotBlank() }",
      "subResponseCode = onPurchasesUpdatedSubResponseCode.toOpenIapSubResponseCode()",
      "BillingClient.BillingProgram.BILLING_CHOICE",
      "BillingProgramReportingDetailsParams.DeveloperBillingType.IN_APP",
      "InAppMessageParams.InAppMessageCategoryId.TRANSACTIONAL",
      "hasProductLevelReplacementParams = subscriptionProductReplacementParams != null",
      "toBillingOperationError(",
    ],
    "KMP Billing Choice Android bindings",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/Helper.kt",
    [
      "OnPurchasesUpdatedSubResponseCode.NO_APPLICABLE_SUB_RESPONSE_CODE",
      "OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS",
      "OnPurchasesUpdatedSubResponseCode.USER_INELIGIBLE",
    ],
    "KMP BillingResult sub-response mapping",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/androidUnitTest/kotlin/io/github/hyochan/kmpiap/BillingResultMappingTest.kt",
    [
      "maps every Play Billing 9_1 sub-response code",
      "unknown sub-response code remains absent",
    ],
    "KMP BillingResult sub-response tests",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/AmazonInAppPurchaseAndroid.kt",
    [
      'failUnsupported("Google Play billing in-app messages are unavailable on $storeName.")',
    ],
    "KMP non-Play in-app message behavior",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/AmazonInAppPurchaseAndroid.kt",
    ["InAppMessageResponseCodeAndroid.NoActionNeeded"],
    "KMP non-Play in-app messages must not report success",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/androidUnitTest/kotlin/io/github/hyochan/kmpiap/UnsupportedGoogleApisTest.kt",
    [
      "non-Play stores reject Google in-app messages",
      "ErrorCode.FeatureNotSupported",
    ],
    "KMP non-Play in-app message tests",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/androidUnitTest/kotlin/io/github/hyochan/kmpiap/SubscriptionReplacementResolutionTest.kt",
    ["hasProductLevelReplacementParams = true"],
    "KMP subscription replacement precedence tests",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/updates/releases.tsx",
    [
      "Horizon uses Billing Compatibility SDK 2.0.0",
      "com.meta.horizon.platform.HORIZON_APP_ID",
    ],
    "Horizon 2.0 release notes",
  );
  expectIncludes(
    "packages/google/openiap/src/horizon/java/dev/hyo/openiap/OpenIapModule.kt",
    [
      "com.meta.horizon.platform.HORIZON_APP_ID",
      "resolveHorizonAppId(appInfo.metaData)",
    ],
    "Horizon App ID canonical key",
  );
  expectIncludes(
    "packages/google/openiap/src/testHorizon/java/dev/hyo/openiap/HorizonAppIdMetadataTest.kt",
    [
      "canonical Horizon metadata resolves the app id",
      "missing or blank Horizon metadata resolves to null",
      "historical Horizon metadata is ignored",
    ],
    "Horizon App ID metadata tests",
  );
  expectIncludes(
    "libraries/expo-iap/plugin/src/withIAP.ts",
    ["com.meta.horizon.platform.HORIZON_APP_ID"],
    "Expo Horizon App ID canonical metadata",
  );
  expectNotIncludes(
    "libraries/expo-iap/plugin/src/withIAP.ts",
    [
      "LEGACY_HORIZON_APP_ID_META_DATA_NAMES",
      "com.meta.horizon.platform.ovr.OCULUS_APP_ID",
      "com.meta.horizon.platform.ovr.HORIZON_APP_ID",
      "com.oculus.vr.APP_ID",
    ],
    "Expo Horizon App ID removed metadata aliases",
  );
  for (const file of [
    "packages/google/Example/src/main/AndroidManifest.xml",
    "libraries/react-native-iap/example/android/app/src/main/AndroidManifest.xml",
    "libraries/flutter_inapp_purchase/example/android/app/src/main/AndroidManifest.xml",
    "packages/docs/src/pages/docs/setup/store/horizon.tsx",
  ]) {
    expectIncludes(
      file,
      ["com.meta.horizon.platform.HORIZON_APP_ID"],
      "Horizon App ID canonical setup",
    );
    expectCodeBlocksNotInclude(
      file,
      [
        "com.meta.horizon.platform.ovr.OCULUS_APP_ID",
        "com.meta.horizon.platform.ovr.HORIZON_APP_ID",
      ],
      "Horizon setup must not recommend legacy metadata keys",
    );
  }
  expectNotIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt",
    ["Full implementation uses Google Play Billing Library 8.2.1"],
    "KMP Play Billing runtime documentation",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/dsl/PurchaseDsl.kt",
    [
      "originalExternalTransactionId",
      "developerBillingOption",
      "subscriptionProductReplacementParams",
    ],
    "KMP Billing Choice purchase DSL fields",
  );

  expectIncludes(
    "libraries/maui-iap/android/openiap/src/main/java/dev/hyo/openiap/maui/OpenIapMauiModule.kt",
    [
      "fun getBillingChoiceInfoAndroid(paramsJson: String, callback: ResultCallback)",
      "fun showBillingProgramInformationDialogAndroid(paramsJson: String, callback: ResultCallback)",
      "fun showInAppMessagesAndroid(paramsJson: String?, callback: ResultCallback)",
      "InitConnectionConfig.fromJson(parseMap(it))",
      "RequestPurchaseProps.fromJson(parseMap(paramsJson))",
      "LaunchExternalLinkParamsAndroid.fromJson(parseMap(paramsJson))",
      "gson.toJson(details.toJson())",
      "gson.toJson(module.showBillingProgramInformationDialog(activity, params).toJson())",
    ],
    "MAUI Billing Choice Kotlin JSON bridge",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/Platforms/Android/OpenIapAndroid.Resolvers.cs",
    [
      "GetBillingChoiceInfoAndroidAsync(GetBillingChoiceInfoParamsAndroid @params)",
      "ShowBillingProgramInformationDialogAndroidAsync(BillingProgramInformationDialogParamsAndroid @params)",
      "ShowInAppMessagesAndroidAsync(InAppMessageParamsAndroid? @params = null)",
      "JsonSerializer.Serialize(config, JsonOptions.Default)",
      "JsonSerializer.Serialize(@params, JsonOptions.Default)",
    ],
    "MAUI Billing Choice C# JSON bridge",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/Platforms/Android/OpenIapAndroid.cs",
    [
      "DeserializeListenerPayload<DeveloperProvidedBillingDetailsAndroid>",
      "JsonSerializer.Deserialize<T>(json, JsonOptions.Default)",
      "catch (JsonException ex)",
      "catch (NotSupportedException ex)",
    ],
    "MAUI Billing Choice event payload",
  );

  for (const [file, bindings] of [
    [
      "packages/gql/src/error.graphql",
      ["subResponseCodeAndroid: SubResponseCodeAndroid"],
    ],
    [
      "packages/google/openiap/src/main/java/dev/hyo/openiap/OpenIapError.kt",
      ['put("subResponseCodeAndroid", subResponseCode?.toJson())'],
    ],
    [
      "packages/google/openiap/src/main/java/dev/hyo/openiap/helpers/CommonHelpers.kt",
      ["subResponseCodeAndroid = this.subResponseCode"],
    ],
    [
      "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
      ["subResponseCodeAndroid?: SubResponseCodeAndroid;"],
    ],
    [
      "libraries/react-native-iap/src/index.ts",
      ["subResponseCodeAndroid: error.subResponseCodeAndroid"],
    ],
    [
      "libraries/expo-iap/src/utils/errorMapping.ts",
      ["error.subResponseCodeAndroid = props.subResponseCodeAndroid"],
    ],
    [
      "libraries/flutter_inapp_purchase/lib/errors.dart",
      ["errorData['subResponseCodeAndroid']"],
    ],
    [
      "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/Helper.kt",
      [
        "subResponseCodeAndroid = onPurchasesUpdatedSubResponseCode.toOpenIapSubResponseCode()",
      ],
    ],
    [
      "libraries/maui-iap/android/openiap/src/main/java/dev/hyo/openiap/maui/OpenIapMauiModule.kt",
      ['"subResponseCodeAndroid" to diagnostics["subResponseCodeAndroid"]'],
    ],
    [
      GENERATED_SYNC_MANIFEST.gdscript.targets.godot.path,
      [
        "var sub_response_code_android: Variant = null",
        'dict["subResponseCodeAndroid"]',
      ],
    ],
  ]) {
    expectIncludes(file, bindings, "PurchaseError sub-response parity");
  }
}

function checkFrameworkDependencyHygiene() {
  const versions = readJson("openiap-versions.json");
  const googleVersion = versions.google;
  if (typeof googleVersion !== "string" || googleVersion.length === 0) {
    fail("openiap-versions.json is missing a google version");
  }

  // Expo SDK 57's lint ecosystem supports ESLint 9, but not ESLint 10 yet.
  // Keep both JavaScript libraries on the newest supported major and preserve
  // the flat-config migration so deprecated eslintrc files cannot return.
  for (const packagePath of [
    "libraries/expo-iap/package.json",
    "libraries/react-native-iap/package.json",
    "libraries/react-native-iap/example/package.json",
  ]) {
    const packageJson = readJson(packagePath);
    if (packageJson.devDependencies?.eslint !== "^9.39.5") {
      fail(`${packagePath} must use the audited ESLint 9.39.5 toolchain`);
    }
    if (packageJson.devDependencies?.globals !== "^17.9.0") {
      fail(`${packagePath} must provide flat-config globals 17.9.0`);
    }
    if (
      packageJson.eslintConfig ||
      packageJson.eslintIgnore ||
      packageJson.devDependencies?.["@react-native/eslint-config"]
    ) {
      fail(`${packagePath} must not restore legacy ESLint configuration`);
    }
  }
  const reactNativeExamplePackage = readJson(
    "libraries/react-native-iap/example/package.json",
  );
  for (const babelPackage of [
    "@babel/core",
    "@babel/preset-env",
    "@babel/runtime",
  ]) {
    if (
      reactNativeExamplePackage.devDependencies?.[babelPackage] !== "^7.29.7"
    ) {
      fail(
        `React Native example ${babelPackage} must use the audited Babel 7.29.7 compatibility line`,
      );
    }
  }
  expectIncludes(
    "libraries/react-native-iap/yarn.lock",
    [
      'resolution: "@babel/core@npm:7.29.7"',
      'resolution: "@babel/preset-env@npm:7.29.7"',
      'resolution: "@babel/runtime@npm:7.29.7"',
    ],
    "React Native example Babel compatibility lock",
  );
  expectIncludes(
    ".github/workflows/ci.yml",
    [
      ":openiap:lintPlayDebug",
      ":openiap:lintHorizonDebug",
      ":openiap:lintAmazonDebug",
    ],
    "Google CI must lint every store flavor for API-23 compatibility",
  );
  expectNotIncludes(
    ".github/workflows/ci.yml",
    ["Amazon lint currently crashes"],
    "Google CI must not retain the obsolete Amazon lint exclusion",
  );
  for (const configPath of [
    "libraries/expo-iap/eslint.config.js",
    "libraries/react-native-iap/eslint.config.js",
    "libraries/react-native-iap/example/eslint.config.js",
  ]) {
    expectIncludes(
      configPath,
      ["eslint-config-expo/flat", "eslint-config-prettier/flat", "globals"],
      `${configPath} ESLint 9 flat config`,
    );
  }
  for (const legacyConfigPath of [
    "libraries/expo-iap/.eslintignore",
    "libraries/expo-iap/.eslintrc.js",
    "libraries/react-native-iap/.eslintignore",
    "libraries/react-native-iap/.eslintrc.js",
    "libraries/react-native-iap/example/.eslintrc.js",
  ]) {
    if (exists(legacyConfigPath)) {
      fail(
        `${legacyConfigPath} must stay removed after the ESLint 9 migration`,
      );
    }
  }
  expectIncludes(
    "libraries/react-native-iap/example/tsconfig.json",
    ['"extends": "@react-native/typescript-config"'],
    "React Native example TypeScript config export",
  );
  expectNotIncludes(
    "libraries/react-native-iap/example/tsconfig.json",
    ["@react-native/typescript-config/tsconfig.json"],
    "React Native example must not use the removed TypeScript config subpath",
  );

  const googleBuildGradle = read("packages/google/openiap/build.gradle.kts");
  const googleCoroutineVersions = uniqueMatches(
    googleBuildGradle,
    /val\s+coroutinesVersion\s*=\s*"([^"]+)"/g,
  );
  if (googleCoroutineVersions.length !== 1) {
    fail(
      `packages/google must use one Kotlinx Coroutines version, found: ${
        googleCoroutineVersions.join(", ") || "(none)"
      }`,
    );
  }
  const googleCoroutinesVersion = googleCoroutineVersions[0];

  for (const [packagePath, versionKey] of [
    ["packages/gql/package.json", "spec"],
    ["packages/docs/package.json", "spec"],
    ["packages/google/package.json", "google"],
    ["packages/apple/package.json", "apple"],
  ]) {
    const packageVersion = readJson(packagePath).version;
    if (packageVersion !== versions[versionKey]) {
      fail(
        `${packagePath} version ${packageVersion} must match openiap-versions.json ${versionKey} ${versions[versionKey]}`,
      );
    }
  }
  expectSymlinkTarget(
    "packages/apple/Sources/openiap-versions.json",
    "../../../openiap-versions.json",
    "Apple package version SSOT link",
  );
  expectSymlinkTarget(
    "packages/google/openiap-versions.json",
    "../../openiap-versions.json",
    "Google package version SSOT link",
  );
  for (const libraryVersionLink of [
    "libraries/react-native-iap/openiap-versions.json",
    "libraries/expo-iap/openiap-versions.json",
    "libraries/flutter_inapp_purchase/openiap-versions.json",
    "libraries/godot-iap/openiap-versions.json",
    "libraries/kmp-iap/openiap-versions.json",
    "libraries/maui-iap/openiap-versions.json",
  ]) {
    expectSymlinkTarget(
      libraryVersionLink,
      "../../openiap-versions.json",
      `${libraryVersionLink} version SSOT link`,
    );
  }
  expectFile("packages/docs/openiap-versions.json");
  if (
    exists("packages/docs/openiap-versions.json") &&
    fs.lstatSync(abs("packages/docs/openiap-versions.json")).isSymbolicLink()
  ) {
    fail(
      "packages/docs/openiap-versions.json must be a real file for Vercel deployment",
    );
  }
  expectSameFile(
    "openiap-versions.json",
    "packages/docs/openiap-versions.json",
    "Docs package version copy",
  );
  expectSymlinkTarget(
    "llms.txt",
    "packages/docs/public/llms.txt",
    "Root llms.txt",
  );
  expectSymlinkTarget(
    "llms-full.txt",
    "packages/docs/public/llms-full.txt",
    "Root llms-full.txt",
  );
  for (const docsLlmsFile of [
    "packages/docs/public/llms.txt",
    "packages/docs/public/llms-full.txt",
  ]) {
    expectFile(docsLlmsFile);
    if (
      exists(docsLlmsFile) &&
      fs.lstatSync(abs(docsLlmsFile)).isSymbolicLink()
    ) {
      fail(`${docsLlmsFile} must be a real file for docs deployment`);
    }
  }
  expectFile("packages/docs/src/generated/version-metadata.json");
  if (exists("packages/docs/src/generated/version-metadata.json")) {
    const docsVersionMetadata = readJson(
      "packages/docs/src/generated/version-metadata.json",
    );
    const expectedDocsVersionMetadata = {
      _generatedBy: "scripts/sync-versions.sh",
      expoPackageVersion: readJson("libraries/expo-iap/package.json").version,
      reactNativePackageVersion: readJson(
        "libraries/react-native-iap/package.json",
      ).version,
      flutterPackageVersion: read(
        "libraries/flutter_inapp_purchase/pubspec.yaml",
      )
        .match(/^version:\s*(.+)$/m)?.[1]
        ?.trim(),
      godotPackageVersion: read(
        "libraries/godot-iap/addons/godot-iap/plugin.cfg",
      )
        .match(/^version="([^"]+)"$/m)?.[1]
        ?.trim(),
      kmpPackageVersion: read("libraries/kmp-iap/gradle.properties")
        .match(/^libraryVersion=(.+)$/m)?.[1]
        ?.trim(),
      mauiPackageId: read(
        "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
      )
        .match(/<PackageId>([^<]+)<\/PackageId>/)?.[1]
        ?.trim(),
      mauiPackageVersion: read(
        "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
      )
        .match(/<PackageVersion>([^<]+)<\/PackageVersion>/)?.[1]
        ?.trim(),
      googleCompileSdk: read("packages/google/openiap/build.gradle.kts").match(
        /compileSdk\s*=\s*(\d+)/,
      )?.[1],
      googleMinSdk: read("packages/google/openiap/build.gradle.kts").match(
        /minSdk\s*=\s*(\d+)/,
      )?.[1],
      googlePlayBillingVersion: read(
        "packages/google/openiap/build.gradle.kts",
      ).match(/val\s+playBillingVersion\s*=\s*"([^"]+)"/)?.[1],
      kmpCompileSdk: read("libraries/kmp-iap/gradle/libs.versions.toml").match(
        /^android-compileSdk = "([^"]+)"/m,
      )?.[1],
      kmpMinSdk: read("libraries/kmp-iap/gradle/libs.versions.toml").match(
        /^android-minSdk = "([^"]+)"/m,
      )?.[1],
      kmpTargetSdk: read("libraries/kmp-iap/gradle/libs.versions.toml").match(
        /^android-targetSdk = "([^"]+)"/m,
      )?.[1],
    };
    for (const [key, expectedValue] of Object.entries(
      expectedDocsVersionMetadata,
    )) {
      if (docsVersionMetadata[key] !== expectedValue) {
        fail(
          `packages/docs/src/generated/version-metadata.json ${key} must be synced from SSOT metadata`,
        );
      }
    }
  }
  expectIncludes(
    "packages/apple/README.md",
    [
      '.package(url: "https://github.com/hyodotdev/openiap.git", from: "<version>")',
      "pod 'openiap', '~> <version>'",
      "Use the latest version from the Swift Package / CocoaPods badges above.",
    ],
    "Apple README install version",
  );
  expectIncludes(
    "packages/google/README.md",
    [
      'implementation("io.github.hyochan.openiap:openiap-google:<version>")',
      "https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google",
    ],
    "Google README install version",
  );
  expectIncludes(
    "packages/docs/src/lib/versioning.ts",
    [
      "type VersionKey = 'spec' | 'google' | 'apple';",
      "'spec'",
      "'google'",
      "'apple'",
      "../generated/version-metadata.json",
      "expoPackageVersion",
      "reactNativePackageVersion",
      "godotPackageVersion",
      "EXPO_PACKAGE_VERSION",
      "REACT_NATIVE_PACKAGE_VERSION",
      "GODOT_PACKAGE_VERSION",
      'dependencyLine: `"expo-iap": "^${EXPO_PACKAGE_VERSION}"`',
    ],
    "docs versioning keys",
  );
  expectNotIncludes(
    "packages/docs/src/lib/versioning.ts",
    ["../../../../libraries/", "../../../../packages/"],
    "docs versioning must not import files outside packages/docs because Vercel uploads the docs package root",
  );
  expectIncludes(
    "packages/docs/src/lib/images.ts",
    [
      "EXPO_PACKAGE.installCommand",
      "REACT_NATIVE_PACKAGE.installCommand",
      "GODOT_PACKAGE.releaseUrl",
    ],
    "docs library metadata must derive framework package versions from metadata",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/setup/expo.tsx",
    ["EXPO_PACKAGE.dependencyLine"],
    "Expo docs package.json example must derive package version from package metadata",
  );
  expectNotIncludes(
    "packages/docs/src/pages/docs/setup/expo.tsx",
    ['"expo-iap": "latest"'],
    "Expo docs package.json example must not use a floating latest version",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/android-setup.tsx",
    ["OPENIAP_VERSIONS.google"],
    "Android setup docs install version",
  );
  expectNotIncludes(
    "packages/apple/README.md",
    [
      "$version",
      `from: "${versions.apple}"`,
      `pod 'openiap', '~> ${versions.apple}'`,
    ],
    "Apple README install version must not be inline hardcoded",
  );
  expectNotIncludes(
    "packages/google/README.md",
    ["$version", `openiap-google:${versions.google}`],
    "Google README install version must not be inline hardcoded",
  );

  for (const localPathFile of [
    "knowledge/internal/07-docs-consistency.md",
    "libraries/kmp-iap/example/run-ios.sh",
  ]) {
    expectNotIncludes(
      localPathFile,
      ["/Users/", "/home/", "C:\\"],
      "tracked scripts/docs must not contain local absolute paths",
    );
  }
  expectOptionalNotIncludes(
    "libraries/expo-iap/example/android/settings.gradle",
    ["/Users/", "/home/", "C:\\"],
    "tracked scripts/docs must not contain local absolute paths",
  );
  for (const canonicalUrlFile of [
    "scripts/audit-docs.ts",
    "libraries/expo-iap/CLAUDE.md",
    "libraries/flutter_inapp_purchase/CLAUDE.md",
    "libraries/kmp-iap/CLAUDE.md",
    "libraries/react-native-iap/CLAUDE.md",
    "libraries/react-native-iap/src/index.ts",
    "libraries/react-native-iap/src/hooks/useIAP.ts",
    "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    "libraries/godot-iap/addons/godot-iap/godot_iap.gd",
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt",
    "libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt",
    "packages/apple/Sources/OpenIapModule.swift",
    "packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt",
  ]) {
    expectNotIncludes(
      canonicalUrlFile,
      ["https://www.openiap.dev"],
      `${canonicalUrlFile} must use canonical OpenIAP URLs`,
    );
  }
  expectIncludes(
    "packages/docs/src/lib/images.ts",
    [
      "documentationUrl: 'https://openiap.dev/docs/setup/expo'",
      "documentationUrl: 'https://openiap.dev/docs/setup/react-native'",
      "documentationUrl: 'https://openiap.dev/docs/setup/flutter'",
      "documentationUrl: 'https://openiap.dev/docs/setup/kmp'",
      "documentationUrl: 'https://openiap.dev/docs/setup/godot'",
    ],
    "docs library cards should point at OpenIAP setup docs",
  );
  expectNotIncludes(
    "packages/docs/src/lib/images.ts",
    [
      "documentationUrl: 'https://hyochan.github.io/expo-iap'",
      "documentationUrl: 'https://hyochan.github.io/react-native-iap'",
      "documentationUrl: 'https://hyochan.github.io/flutter_inapp_purchase'",
      "documentationUrl: 'https://hyochan.github.io/kmp-iap'",
      "documentationUrl: 'https://hyochan.github.io/godot-iap'",
    ],
    "docs library cards must not point at legacy standalone docs",
  );
  expectIncludes(
    "CHANGELOG.md",
    [
      "https://openiap.dev/docs/updates/releases",
      "https://github.com/hyodotdev/openiap/releases",
    ],
    "root changelog should point at OpenIAP release SSOT",
  );
  expectNotIncludes(
    "CHANGELOG.md",
    ["https://www.openiap.dev/docs/updates/notes"],
    "root changelog must not point at redirected release notes URL",
  );
  expectIncludes(
    "libraries/expo-iap/README.md",
    [
      "https://openiap.dev/frameworks/expo.svg",
      "https://openiap.dev/docs/setup/expo",
      "https://openiap.dev/docs/guides/ai-assistants",
      "https://openiap.dev/llms.txt",
      "https://openiap.dev/docs/setup/store/onside",
      "https://github.com/hyodotdev/openiap/discussions/categories/expo-iap",
      "https://openiap.dev/sponsors/nami.webp",
      "https://openiap.dev/sponsors/courier.webp",
    ],
    "Expo README docs links",
  );
  expectIncludes(
    "libraries/expo-iap/CONTRIBUTING.md",
    ["https://openiap.dev/docs/setup/expo", "https://openiap.dev/docs/apis"],
    "Expo contributing docs links",
  );
  expectIncludes(
    "libraries/expo-iap/src/index.ts",
    ["https://openiap.dev/docs/apis/request-purchase"],
    "Expo runtime docs links",
  );
  expectIncludes(
    "libraries/expo-iap/src/useIAP.ts",
    [
      "https://openiap.dev/docs/setup/expo#useIAP-hook",
      "https://openiap.dev/docs/apis/request-purchase",
    ],
    "Expo useIAP docs links",
  );
  expectNotIncludes(
    "libraries/expo-iap/README.md",
    [
      "](https://hyochan.github.io/expo-iap",
      "https://hyochan.github.io/expo-iap/guides",
      "https://hyochan.github.io/expo-iap/llms",
      "https://hyochan.github.io/expo-iap/getting-started",
      "https://github.com/hyochan/expo-iap/discussions/143",
      "https://github.com/hyochan/react-native-iap/discussions/2754",
      "https://github.com/hyochan/react-native-iap/assets",
      "https://github.com/user-attachments/assets/319d8966-6839-498d-8ead-ce8cc72c3bca",
      "https://www.openiap.dev",
    ],
    "Expo README must not point at legacy standalone docs",
  );
  expectIncludes(
    "libraries/expo-iap/CHANGELOG.md",
    [
      "https://openiap.dev/docs/updates/releases",
      "https://github.com/hyodotdev/openiap/releases?q=expo-iap&expanded=true",
    ],
    "Expo changelog release SSOT links",
  );
  expectNotIncludes(
    "libraries/expo-iap/CHANGELOG.md",
    ["github.com/hyochan/expo-iap"],
    "Expo changelog must not point at the legacy standalone repository",
  );
  for (const expoDocsFile of [
    "libraries/expo-iap/CONTRIBUTING.md",
    "libraries/expo-iap/src/index.ts",
    "libraries/expo-iap/src/useIAP.ts",
    "libraries/expo-iap/src/modules/android.ts",
    "libraries/expo-iap/src/modules/ios.ts",
  ]) {
    expectNotIncludes(
      expoDocsFile,
      ["hyochan.github.io/expo-iap", "https://www.openiap.dev"],
      `${expoDocsFile} must not point at legacy standalone docs`,
    );
  }
  expectIncludes(
    "libraries/react-native-iap/README.md",
    [
      "https://openiap.dev/frameworks/react-native.webp",
      "https://openiap.dev/docs/setup/react-native",
      "https://openiap.dev/docs/guides/ai-assistants",
      "https://openiap.dev/llms.txt",
      "https://openiap.dev/docs/apis",
      "https://openiap.dev/docs/errors",
      "https://openiap.dev/sponsors/nami.webp",
      "https://openiap.dev/sponsors/courier.webp",
    ],
    "React Native README docs links",
  );
  expectIncludes(
    "libraries/react-native-iap/CONTRIBUTING.md",
    ["https://openiap.dev/docs/setup/react-native"],
    "React Native contributing docs links",
  );
  expectNotIncludes(
    "libraries/react-native-iap/README.md",
    [
      "](https://hyochan.github.io/react-native-iap",
      "https://hyochan.github.io/react-native-iap/docs",
      "https://hyochan.github.io/react-native-iap/llms",
      "https://github.com/hyochan/react-native-iap/assets",
      "https://github.com/user-attachments/assets/319d8966-6839-498d-8ead-ce8cc72c3bca",
      "https://www.openiap.dev",
    ],
    "React Native README must not point at legacy standalone docs",
  );
  expectIncludes(
    "libraries/react-native-iap/CHANGELOG.md",
    [
      "https://openiap.dev/docs/updates/releases",
      "https://github.com/hyodotdev/openiap/releases?q=react-native-iap&expanded=true",
    ],
    "React Native changelog release SSOT links",
  );
  expectNotIncludes(
    "libraries/react-native-iap/CHANGELOG.md",
    ["github.com/hyochan/react-native-iap"],
    "React Native changelog must not point at the legacy standalone repository",
  );
  expectNotIncludes(
    "libraries/react-native-iap/CONTRIBUTING.md",
    [
      "hyochan.github.io/react-native-iap",
      "Recent highlights (",
      "OpenIAP to `~>",
    ],
    "React Native contributing must not point at legacy standalone docs",
  );
  expectIncludes(
    "libraries/react-native-iap/scripts/ci-check.sh",
    [
      "run_check()",
      'run_check "📦 Installing dependencies..."',
      'run_check "🧪 Running tests..."',
    ],
    "React Native local CI script should use shared check helper",
  );
  expectNotIncludes(
    "libraries/react-native-iap/scripts/ci-check.sh",
    ["if [ $? -ne 0 ]; then"],
    "React Native local CI script should not repeat exit-code checks",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/README.md",
    [
      "https://openiap.dev/frameworks/flutter.svg",
      "https://openiap.dev/docs/setup/flutter",
      "https://openiap.dev/docs/guides/ai-assistants",
      "https://openiap.dev/llms.txt",
    ],
    "Flutter README docs links",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/CONTRIBUTING.md",
    ["https://github.com/hyodotdev/openiap/discussions"],
    "Flutter contributing discussion links",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/README.md",
    [
      "](https://hyochan.github.io/flutter_inapp_purchase",
      "https://hyochan.github.io/flutter_inapp_purchase/docs",
      "https://hyochan.github.io/flutter_inapp_purchase/llms",
    ],
    "Flutter README must not point at legacy standalone docs",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/CONTRIBUTING.md",
    ["github.com/hyochan/openiap.dev"],
    "Flutter contributing links must point at the monorepo",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/CHANGELOG.md",
    [
      "https://openiap.dev/docs/updates/releases",
      "https://github.com/hyodotdev/openiap/releases?q=flutter-iap&expanded=true",
    ],
    "Flutter changelog release SSOT links",
  );
  expectNoMatch(
    "libraries/flutter_inapp_purchase/CHANGELOG.md",
    /^## 9\.[^\r\n]*\r?\n\r?\n- Initial release\r?$/m,
    "Flutter v9 changelog entries must not be placeholders",
  );
  expectIncludes(
    ".github/workflows/release-flutter.yml",
    [
      "flutter-iap-$PREV_VERSION",
      'CONSOLIDATED_RELEASE_NOTES="https://openiap.dev/docs/updates/releases"',
    ],
    "Flutter release workflow should generate changelog entries from prefixed tags",
  );
  expectIncludes(
    "libraries/godot-iap/README.md",
    [
      "https://openiap.dev/docs/setup/godot",
      "https://openiap.dev/docs/guides/ai-assistants",
      "https://openiap.dev/llms.txt",
      "https://openiap.dev/docs/apis",
      "https://openiap.dev/docs/example",
      "[LICENSE](../../LICENSE)",
    ],
    "Godot README docs links",
  );
  expectIncludes(
    "libraries/godot-iap/CONTRIBUTING.md",
    [
      "https://github.com/hyodotdev/openiap/issues",
      "https://openiap.dev/docs/setup/godot",
    ],
    "Godot contributing docs links",
  );
  expectIncludes(
    "libraries/godot-iap/EXAMPLES.md",
    ["https://openiap.dev/docs/setup/godot", "https://openiap.dev/docs/apis"],
    "Godot examples docs links",
  );
  for (const godotDocsFile of [
    "libraries/godot-iap/README.md",
    "libraries/godot-iap/CONTRIBUTING.md",
    "libraries/godot-iap/EXAMPLES.md",
  ]) {
    expectNotIncludes(
      godotDocsFile,
      [
        "hyochan.github.io/godot-iap",
        "github.com/hyochan/godot-iap",
        "[LICENSE](LICENSE)",
      ],
      `${godotDocsFile} must not point at legacy standalone docs`,
    );
  }

  const kmpVersion = read("libraries/kmp-iap/gradle.properties")
    .match(/^libraryVersion=(.+)$/m)?.[1]
    ?.trim();
  const kmpLibraryVersions = read(
    "libraries/kmp-iap/gradle/libs.versions.toml",
  );
  const kmpKotlinVersion =
    kmpLibraryVersions.match(/^kotlin = "([^"]+)"/m)?.[1];
  const kmpGradleVersion = read(
    "libraries/kmp-iap/gradle/wrapper/gradle-wrapper.properties",
  ).match(/gradle-([^-]+)-bin\.zip/)?.[1];
  const flutterVersion = read("libraries/flutter_inapp_purchase/pubspec.yaml")
    .match(/^version:\s*(.+)$/m)?.[1]
    ?.trim();
  const mauiVersion = read(
    "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
  )
    .match(/<PackageVersion>([^<]+)<\/PackageVersion>/)?.[1]
    ?.trim();
  if (!kmpVersion)
    fail("libraries/kmp-iap/gradle.properties is missing libraryVersion");
  if (!flutterVersion)
    fail("libraries/flutter_inapp_purchase/pubspec.yaml is missing version");
  if (!mauiVersion) fail("OpenIap.Maui.csproj is missing PackageVersion");
  if (flutterVersion) {
    expectIncludes(
      "packages/docs/src/lib/versioning.ts",
      [
        "flutterPackageVersion",
        "FLUTTER_PACKAGE",
        "dependencyLine: `flutter_inapp_purchase: ^${FLUTTER_PACKAGE_VERSION}`",
      ],
      "docs Flutter package metadata must derive from generated docs metadata",
    );
    expectIncludes(
      "packages/docs/src/lib/images.ts",
      ["FLUTTER_PACKAGE.installCommand"],
      "docs Flutter library listing install command",
    );
    expectIncludes(
      "packages/docs/src/pages/docs/setup/flutter.tsx",
      ["ANDROID_SDK", "FLUTTER_PACKAGE", "FLUTTER_PACKAGE.dependencyLine"],
      "Flutter setup docs package metadata",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/README.md",
      [
        "flutter pub add flutter_inapp_purchase",
        "https://pub.dev/packages/flutter_inapp_purchase",
      ],
      "Flutter README should reference pub.dev without an inline version",
    );
    for (const flutterDoc of [
      "libraries/flutter_inapp_purchase/README.md",
      "packages/docs/src/pages/docs/setup/flutter.tsx",
    ]) {
      expectNotIncludes(
        flutterDoc,
        [`flutter_inapp_purchase: ^${flutterVersion}`],
        "Flutter install command version must not be inline hardcoded",
      );
    }
    for (const flutterPodspec of [
      "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase.podspec",
      "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase.podspec",
    ]) {
      expectIncludes(
        flutterPodspec,
        [
          "pubspec_path",
          "pubspec_version",
          "s.version          = pubspec_version",
        ],
        "Flutter podspec version must derive from pubspec.yaml",
      );
      expectNotIncludes(
        flutterPodspec,
        ["s.version          = '0.0.1'"],
        "Flutter podspec version must not drift from pubspec.yaml",
      );
    }
    expectNotIncludes(
      "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase.podspec",
      ["http://example.com", "Your Company", "email@example.com"],
      "Flutter iOS podspec metadata must not use placeholders",
    );
  }
  if (kmpVersion) {
    expectIncludes(
      "packages/docs/src/lib/versioning.ts",
      [
        "kmpPackageVersion",
        "KMP_PACKAGE",
        'installCommand: `implementation("io.github.hyochan:kmp-iap:${KMP_PACKAGE_VERSION}")`',
      ],
      "docs KMP package metadata must derive from generated docs metadata",
    );
    expectIncludes(
      "packages/docs/src/lib/images.ts",
      ["KMP_PACKAGE.installCommand"],
      "docs KMP install command",
    );
    expectIncludes(
      "packages/docs/src/pages/docs/setup/kmp.tsx",
      [
        "LIBRARIES.find(({ name }) => name === 'kmp-iap')",
        "KMP_ANDROID_SDK",
        "KMP_INSTALL_COMMAND",
        "KMP_VERSION",
      ],
      "KMP setup docs install command",
    );
    expectNotIncludes(
      "packages/docs/src/pages/docs/setup/kmp.tsx",
      ["<latest-version>"],
      "KMP setup docs install command must be copyable",
    );
    expectIncludes(
      "libraries/kmp-iap/README.md",
      [
        'implementation("io.github.hyochan:kmp-iap:<version>")',
        "https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap",
        "https://openiap.dev/docs/setup/kmp",
        "https://openiap.dev/llms.txt",
        "license-Apache--2.0",
        "Apache License 2.0",
      ],
      "KMP README should reference Maven Central without an inline version",
    );
    expectNotIncludes(
      "libraries/kmp-iap/README.md",
      [
        `implementation("io.github.hyochan:kmp-iap:${kmpVersion}")`,
        "hyochan.github.io/kmp-iap",
        "license-MIT",
        "MIT License",
      ],
      "KMP README install command version must not be inline hardcoded",
    );
    expectIncludes(
      "libraries/kmp-iap/library/library.podspec",
      [
        "gradle_properties_file",
        "libraryVersion=",
        "spec.version                  = library_version",
        "spec.source                   = { :git => 'https://github.com/hyodotdev/openiap.git', :tag => \"kmp-iap-#{library_version}\" }",
        "spec.authors                  = { 'Hyo Dev' => 'hyo@hyo.dev' }",
        "spec.license                  = { :type => 'Apache-2.0', :file => '../LICENSE' }",
      ],
      "KMP podspec version",
    );
    expectNotIncludes(
      "libraries/kmp-iap/library/library.podspec",
      [
        `spec.version                  = '${kmpVersion}'`,
        "spec.source                   = { :http=> ''}",
        "spec.authors                  = ''",
        "spec.license                  = ''",
      ],
      "KMP podspec version must derive from gradle.properties",
    );
    expectIncludes(
      "libraries/kmp-iap/library/build.gradle.kts",
      [
        "fun dynamicKmpPodspec(): String",
        'tasks.matching { it.name == "podspec" }.configureEach',
        'projectDir.resolve("library.podspec").writeText(dynamicKmpPodspec())',
        "spec.version                  = library_version",
        "openiap_apple_version = openiap_versions['apple']",
      ],
      "KMP podspec Gradle generator must preserve dynamic metadata",
    );
  }
  const kmpExampleVersions = read(
    "libraries/kmp-iap/example/gradle/libs.versions.toml",
  );
  const kmpExampleKotlinVersion =
    kmpExampleVersions.match(/^kotlin = "([^"]+)"/m)?.[1];
  const kmpExampleGradleVersion = read(
    "libraries/kmp-iap/example/gradle/wrapper/gradle-wrapper.properties",
  ).match(/gradle-([^-]+)-bin\.zip/)?.[1];
  const kmpCompileSdk = kmpExampleVersions.match(
    /^android-compileSdk = "([^"]+)"/m,
  )?.[1];
  const kmpMinSdk = kmpExampleVersions.match(
    /^android-minSdk = "([^"]+)"/m,
  )?.[1];
  const kmpTargetSdk = kmpExampleVersions.match(
    /^android-targetSdk = "([^"]+)"/m,
  )?.[1];
  if (!kmpKotlinVersion || !kmpGradleVersion) {
    fail("KMP library must declare Kotlin and Gradle wrapper versions");
  } else if (kmpExampleKotlinVersion !== kmpKotlinVersion) {
    fail(
      `KMP example Kotlin ${kmpExampleKotlinVersion} must match library Kotlin ${kmpKotlinVersion}`,
    );
  } else if (kmpExampleGradleVersion !== kmpGradleVersion) {
    fail(
      `KMP example Gradle ${
        kmpExampleGradleVersion || "(missing)"
      } must match library Gradle ${kmpGradleVersion}`,
    );
  } else {
    expectIncludes(
      "packages/docs/src/pages/docs/setup/kmp.tsx",
      [`Kotlin ${kmpKotlinVersion}`, `Gradle ${kmpGradleVersion}`, "JDK 17+"],
      "KMP setup docs toolchain versions",
    );
    for (const mobileOnlyFile of [
      "libraries/kmp-iap/example/README.md",
      "libraries/kmp-iap/setup.sh",
      "libraries/kmp-iap/setup.bat",
      "libraries/kmp-iap/library/build.gradle.kts",
    ]) {
      expectNotIncludes(
        mobileOnlyFile,
        [
          ":example:run",
          "wasmJsBrowserDevelopmentRun",
          "Android, iOS, Desktop, and Web",
        ],
        "KMP mobile-only targets must not advertise removed desktop or web tasks",
      );
    }
    expectIncludes(
      "libraries/kmp-iap/example/README.md",
      [":example:composeApp:installPlayDebug", "Android and iOS"],
      "KMP example docs must use the current mobile target and task",
    );
    for (const removedKmpExamplePath of [
      "libraries/kmp-iap/example/composeApp/src/jvmMain/kotlin/dev/hyo/martie/main.kt",
      "libraries/kmp-iap/example/composeApp/src/jvmMain/kotlin/dev/hyo/martie/config/AppConfig.jvm.kt",
      "libraries/kmp-iap/example/composeApp/src/jvmMain/kotlin/dev/hyo/martie/screens/PlatformTime.jvm.kt",
      "libraries/kmp-iap/example/kotlin-js-store/wasm/yarn.lock",
    ]) {
      if (exists(removedKmpExamplePath)) {
        fail(
          `${removedKmpExamplePath} must remain removed with desktop and web targets`,
        );
      }
    }
    expectNotIncludes(
      "libraries/kmp-iap/example/gradle/libs.versions.toml",
      ["kotlinx-coroutines-swing", "kotlinx-coroutinesSwing"],
      "KMP Android/iOS example must not retain desktop coroutine aliases",
    );
    expectNotIncludes(
      "libraries/kmp-iap/example/composeApp/build.gradle.kts",
      [
        'jvm("desktop")',
        "wasmJs",
        "compose.desktop",
        "kotlinx-coroutines-swing",
      ],
      "KMP Android/iOS example must not retain unsupported desktop or Wasm targets",
    );
    expectIncludes(
      "libraries/kmp-iap/CONTRIBUTING.md",
      [
        "JDK 17 or higher",
        "https://github.com/hyodotdev/openiap/issues",
        "https://github.com/hyodotdev/openiap/discussions/categories/kmp-iap",
      ],
      "KMP contributing JDK requirement",
    );
    expectNotIncludes(
      "libraries/kmp-iap/CONTRIBUTING.md",
      ["github.com/hyochan/kmp-iap", "github.com/hyochan/openiap.dev"],
      "KMP contributing links must point at the monorepo",
    );
    expectIncludes(
      "libraries/kmp-iap/CHANGELOG.md",
      ["https://github.com/hyodotdev/openiap/releases?q=kmp-iap&expanded=true"],
      "KMP changelog release link",
    );
    expectNotIncludes(
      "libraries/kmp-iap/CHANGELOG.md",
      ["github.com/hyochan/kmp-iap"],
      "KMP changelog must not point at the legacy standalone repository",
    );
  }
  if (!kmpCompileSdk || !kmpMinSdk || !kmpTargetSdk) {
    fail("KMP example libs.versions.toml must declare Android SDK versions");
  } else {
    expectIncludes(
      "packages/docs/src/lib/versioning.ts",
      [
        "kmpCompileSdk",
        "kmpMinSdk",
        "kmpTargetSdk",
        "export const KMP_ANDROID_SDK",
      ],
      "docs KMP Android SDK metadata must derive from generated docs metadata",
    );
    expectIncludes(
      "packages/docs/src/pages/docs/setup/kmp.tsx",
      [
        "compileSdk = ${KMP_ANDROID_SDK.compileSdk}",
        "minSdk = ${KMP_ANDROID_SDK.minSdk}",
        "targetSdk = ${KMP_ANDROID_SDK.targetSdk}",
      ],
      "KMP setup docs Android SDK versions",
    );
    expectNotIncludes(
      "packages/docs/src/pages/docs/setup/kmp.tsx",
      [
        `compileSdk = ${kmpCompileSdk}`,
        `minSdk = ${kmpMinSdk}`,
        `targetSdk = ${kmpTargetSdk}`,
      ],
      "KMP setup docs Android SDK versions must not be inline hardcoded",
    );
  }
  expectIncludes(
    "libraries/kmp-iap/gradle/libs.versions.toml",
    [
      'compose-material-icons = "1.7.3"',
      "compose-material-icons-extended",
      'version.ref = "compose-material-icons"',
    ],
    "KMP root Compose icon dependency",
  );
  expectIncludes(
    "libraries/kmp-iap/example/gradle/libs.versions.toml",
    [
      'compose-material-icons = "1.7.3"',
      "compose-material-icons-extended",
      'version.ref = "compose-material-icons"',
    ],
    "KMP standalone example Compose icon dependency",
  );
  expectIncludes(
    "libraries/kmp-iap/example/gradle/libs.versions.toml",
    ['androidx-lifecycle = "2.10.0"', "requires Android API 37 / AGP 9.1"],
    "KMP standalone example Lifecycle compatibility cap",
  );
  expectNotIncludes(
    "libraries/kmp-iap/example/gradle/libs.versions.toml",
    ['androidx-lifecycle = "2.11.0"'],
    "KMP standalone example must not exceed the API 36 compatible Lifecycle line",
  );
  expectIncludes(
    "libraries/kmp-iap/example/composeApp/build.gradle.kts",
    ["libs.compose.material.icons.extended", "-Xexpect-actual-classes"],
    "KMP example Compose icon dependency",
  );
  expectIncludes(
    "libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/SubscriptionFlowScreen.kt",
    ["List<ProductSubscription>", "FetchProductsResultSubscriptions"],
    "KMP example subscription product handling",
  );
  expectNotIncludes(
    "libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/SubscriptionFlowScreen.kt",
    ["is ProductAndroid", "is ProductIOS"],
    "KMP example subscription product handling must not type-check impossible product variants",
  );
  if (mauiVersion) {
    expectIncludes(
      "packages/docs/src/lib/versioning.ts",
      [
        "mauiPackageId",
        "mauiPackageVersion",
        "MAUI_PACKAGE",
        "installCommand: `dotnet add package ${MAUI_PACKAGE_ID}`",
        'packageReference: `<PackageReference Include="${MAUI_PACKAGE_ID}" Version="${MAUI_PACKAGE_VERSION}" />`',
      ],
      "docs MAUI package metadata must derive from generated docs metadata",
    );
    expectIncludes(
      "packages/docs/src/lib/images.ts",
      ["MAUI_PACKAGE", "installCommand: MAUI_PACKAGE.installCommand"],
      "docs MAUI library listing install command",
    );
    expectIncludes(
      "packages/docs/src/pages/docs/setup/maui.tsx",
      [
        "import { MAUI_PACKAGE } from '../../../lib/versioning'",
        "MAUI_PACKAGE.installCommand",
        "MAUI_PACKAGE.packageReference",
        "MAUI_PACKAGE.versionedNugetUrl",
      ],
      "MAUI setup docs package metadata",
    );
    expectIncludes(
      "libraries/maui-iap/README.md",
      [
        "dotnet add package OpenIap.Maui",
        "https://www.nuget.org/packages/OpenIap.Maui",
      ],
      "MAUI README should reference the NuGet package without an inline version",
    );
    for (const mauiInstallDoc of [
      "packages/docs/src/lib/images.ts",
      "packages/docs/src/pages/docs/setup/maui.tsx",
      "libraries/maui-iap/README.md",
    ]) {
      expectNotIncludes(
        mauiInstallDoc,
        [`OpenIap.Maui --version ${mauiVersion}`],
        "MAUI install command version must not be inline hardcoded",
      );
    }
    for (const mauiPackageReferenceDoc of [
      "packages/docs/src/pages/docs/setup/maui.tsx",
      "libraries/maui-iap/README.md",
    ]) {
      expectNotIncludes(
        mauiPackageReferenceDoc,
        [
          `<PackageReference Include="OpenIap.Maui" Version="${mauiVersion}" />`,
        ],
        "MAUI PackageReference version must not be inline hardcoded",
      );
    }
  }

  expectIncludes(
    "scripts/sync-versions.mjs",
    ["openiap-versions.json", "./scripts/sync-versions.sh"],
    "root version sync script",
  );
  expectNotIncludes(
    "scripts/sync-versions.mjs",
    ["writeFileSync", "pkgJson.version", "const packages = ["],
    "root version sync wrapper must delegate writes to scripts/sync-versions.sh",
  );
  expectIncludes(
    "scripts/sync-versions.sh",
    [
      "set -euo pipefail",
      'sync_package_json_version "packages/gql/package.json" "spec"',
      'sync_package_json_version "packages/docs/package.json" "spec"',
      'sync_package_json_version "packages/google/package.json" "google"',
      'sync_package_json_version "packages/apple/package.json" "apple"',
    ],
    "shell version sync must update package metadata for release workflows",
  );
  if (exists("packages/gql/package-lock.json")) {
    fail(
      "packages/gql must not keep a stale npm package-lock.json; Bun lockfiles are the package-manager SSOT",
    );
  }
  expectIncludes(
    "packages/gql/README.md",
    ["bun install --frozen-lockfile"],
    "GQL README must document Bun installs",
  );
  expectNotIncludes(
    "packages/gql/README.md",
    ["npm install"],
    "GQL README must not document npm installs",
  );
  expectIncludes(
    ".gitignore",
    ["package-lock.json"],
    "root gitignore must prevent npm lockfile drift in Bun-managed packages",
  );
  for (const bunPackageJson of [
    "packages/gql/package.json",
    "packages/docs/package.json",
    "packages/google/package.json",
    "packages/apple/package.json",
  ]) {
    expectIncludes(
      bunPackageJson,
      ['"packageManager": "bun@1.3.13"'],
      `${bunPackageJson} package manager must match the monorepo Bun version`,
    );
  }
  for (const bunWorkflow of [
    ".github/workflows/ci.yml",
    ".github/workflows/ci-expo-iap.yml",
    ".github/workflows/release-expo.yml",
  ]) {
    expectIncludes(
      bunWorkflow,
      ["bun-version: 1.3.13"],
      `${bunWorkflow} must pin Bun to the monorepo packageManager version`,
    );
    expectNotIncludes(
      bunWorkflow,
      ['bun-version: "1.1.38"', "bun-version: latest"],
      `${bunWorkflow} must not drift from the monorepo Bun version`,
    );
  }
  for (const bunInstallWorkflow of [
    ".github/workflows/ci.yml",
    ".github/workflows/ci-expo-iap.yml",
    ".github/workflows/release-expo.yml",
  ]) {
    expectIncludes(
      bunInstallWorkflow,
      ["bun install --frozen-lockfile"],
      `${bunInstallWorkflow} must enforce lockfile installs`,
    );
    expectNotIncludes(
      bunInstallWorkflow,
      ["run: bun install\n", "bun install && break"],
      `${bunInstallWorkflow} must not allow lockfile drift during installs`,
    );
  }
  expectIncludes(
    "packages/google/scripts/publish-local.sh",
    ["${openIapGroupId:-io.github.hyochan.openiap}:openiap-google"],
    "Google publish-local coordinate hint",
  );
  expectNotIncludes(
    "packages/google/scripts/publish-local.sh",
    ["${openIapGroupId:-io.github.hyochan}:openiap-google"],
    "Google publish-local coordinate hint must use published groupId",
  );
  expectIncludes(
    "packages/google/scripts/update-version.sh",
    [
      'REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"',
      'node "$REPO_ROOT/scripts/release-branch-policy.mjs"',
      'update-native google "$VERSION"',
      '"$REPO_ROOT/scripts/sync-versions.sh"',
      "packages/*/openiap-versions.json",
      "packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json",
    ],
    "Google update-version must preserve openiap-versions.json fields",
  );
  expectNotIncludes(
    "packages/google/scripts/update-version.sh",
    [
      'cat > "$VERSIONS_FILE"',
      '"spec": "$SPEC_VERSION"',
      '"google": "$VERSION"',
      "'.google = $version'",
      "sed -i",
    ],
    "Google update-version must not rewrite openiap-versions.json or use platform sed",
  );
  expectIncludes(
    "packages/apple/scripts/bump-version.sh",
    [
      'REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"',
      "jq -er '.apple | select(type == \"string\" and length > 0)'",
      'python3 - "${VERSIONS_FILE}"',
      'raise SystemExit(f"missing apple in {path}")',
      'node "$REPO_ROOT/scripts/release-branch-policy.mjs"',
      'update-native apple "$NEW_VERSION"',
      '"$REPO_ROOT/scripts/sync-versions.sh"',
      "packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json",
      'git commit -m "chore(apple): bump version to $NEW_VERSION"',
      "git pull --rebase origin main",
      "git push origin HEAD:main",
      'git ls-remote --exit-code --tags origin "refs/tags/$NEW_VERSION"',
    ],
    "Apple bump-version must preserve openiap-versions.json fields",
  );
  expectNotIncludes(
    "packages/apple/scripts/bump-version.sh",
    [
      "openiap-apple.git",
      "sed -i",
      "chore: bump version",
      'git tag -d "$NEW_VERSION"',
    ],
    "Apple bump-version must use monorepo coordinates and conventional commits",
  );
  expectIncludes(
    "scripts/deploy.sh",
    [
      "set -euo pipefail",
      'VERCEL_CLI_VERSION="54.0.0"',
      'npm install -g "vercel@$VERCEL_CLI_VERSION"',
      'if [ -n "${1:-}" ] && [ "$1" != "$VERSION" ]; then',
      "if ! ./scripts/sync-versions.sh; then",
      "if ! bun run typecheck; then",
      "if ! bun run build; then",
      "if ! vercel --prod; then",
      "release-branch-policy.mjs assert-floor",
      "release-branch-policy.mjs guard docs current false",
      "git fetch --no-tags origin main",
      "LOCAL_HEAD=$(git rev-parse HEAD)",
      "REMOTE_HEAD=$(git rev-parse origin/main)",
      "OpenIAP Spec cannot be bumped independently",
      "Version metadata was not synchronized on main",
      'DOCS_TAG="docs-$VERSION"',
      "git ls-remote --exit-code --tags origin",
      "already exists, so no new Docs GitHub Release is needed",
      "has no Docs GitHub Release yet",
    ],
    "deploy script derived spec policy",
  );
  expectNotIncludes(
    "scripts/deploy.sh",
    [
      "npm install -g vercel",
      "if [ $? -ne 0 ]; then",
      "'.spec = $version'",
      'git commit -m "chore(spec)',
      "git push origin HEAD:main",
    ],
    "deploy script must not install a floating Vercel CLI",
  );
  expectIncludes(
    "packages/docs/deploy.sh",
    [
      "set -euo pipefail",
      "REPO_ROOT=",
      'cd "$REPO_ROOT"',
      'exec ./scripts/deploy.sh "$@"',
    ],
    "docs deploy script must delegate to the canonical root deployment script",
  );
  expectNotIncludes(
    "packages/docs/deploy.sh",
    ["npm install", "vercel --prod", "bun run typecheck", "bun run build"],
    "docs deploy wrapper must not duplicate root deployment behavior",
  );
  expectIncludes(
    ".github/workflows/deploy-kit.yml",
    [
      "if: github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')",
      "- name: Validate required deployment secrets",
      "- name: Deploy Convex functions",
      "- name: Deploy",
    ],
    "Kit deploy must be main-only and validate both deployment surfaces",
  );
  expectNotIncludes(
    ".github/workflows/deploy-kit.yml",
    [
      "if: ${{ env.KIT_CONVEX_DEPLOY_KEY != '' }}",
      "--typecheck=disable",
      "--typecheck disable",
    ],
    "Kit production deploy must neither skip Convex nor disable its typecheck",
  );
  expectIncludes(
    "packages/kit/package.json",
    [
      '"lint": "run-s lint:tsc lint:convex lint:eslint"',
      '"lint:convex": "convex typecheck"',
    ],
    "Kit lint must reproduce the Convex deploy typecheck before merge",
  );
  expectIncludes(
    "packages/kit/convex/tsconfig.json",
    ['"include": ["./**/*"]', '"exclude": ["./_generated"]'],
    "Convex typecheck must cover production and test TypeScript",
  );
  expectNotIncludes(
    "packages/kit/convex/tsconfig.json",
    ["*.test.ts", "*.spec.ts"],
    "Convex typecheck must not hide test TypeScript",
  );
  const kitDeployWorkflow = read(".github/workflows/deploy-kit.yml");
  const validateDeploySecrets = kitDeployWorkflow.indexOf(
    "- name: Validate required deployment secrets",
  );
  const deployConvex = kitDeployWorkflow.indexOf(
    "- name: Deploy Convex functions",
  );
  const deployFly = kitDeployWorkflow.indexOf("- name: Deploy\n");
  if (
    validateDeploySecrets === -1 ||
    deployConvex === -1 ||
    deployFly === -1 ||
    !(validateDeploySecrets < deployConvex && deployConvex < deployFly)
  ) {
    fail(
      "Kit production deploy must validate secrets, then deploy Convex before Fly",
    );
  }
  expectIncludes(
    "packages/kit/public/llms.txt",
    [
      "Purchase verification: `Authorization: Bearer openiap-kit_pk_<publishable-key>`",
      "MCP/admin: `Authorization: Bearer openiap-kit_sk_<secret-key>`",
      "Administrative product,",
      "subscription analytics, MCP, and store-sync requests keep the secret in the",
      "Bearer header and out of URLs.",
      "default 600 per key",
      "an exact store-verified `productId` match",
      "no-store liveness metadata",
      "public revision",
      "no Convex round-trip",
    ],
    "Kit compact assistant contract must match authentication and safety SSOT",
  );
  expectNotIncludes(
    "packages/kit/public/llms.txt",
    ["default 60 per key", "IAPKit is a single-package"],
    "Kit compact assistant contract must not retain stale limits or topology",
  );
  expectIncludes(
    "packages/kit/public/llms-full.txt",
    [
      "github.com/hyodotdev/openiap/tree/main/packages/kit",
      ".github/workflows/deploy-kit.yml",
      "Apple/Amazon: consumable ready for durable fulfillment",
      "deploys additive Convex functions",
      '"apiVersion": "v1"',
      '"revision": "a1b2c3d4e5f6"',
      "Cache-Control: no-store",
      "no Convex",
    ],
    "Kit full assistant contract must follow monorepo deployment and state SSOT",
  );
  expectNotIncludes(
    "packages/kit/public/llms-full.txt",
    [
      "github.com/hyodotdev/openiap-kit",
      ".github/workflows/deploy.yml",
      "Every API request must carry a Bearer token",
      "Single-package repo",
      "the live server wins",
    ],
    "Kit full assistant contract must not retain stale repository or auth claims",
  );
  expectIncludes(
    "packages/kit/src/pages/docs/sections/quickstart.tsx",
    [
      "Never unlock or deliver from <code>isValid</code> alone",
      "Payload omission does not invalidate",
    ],
    "Kit quickstart must preserve fail-closed verification guidance",
  );
  expectNotIncludes(
    "packages/kit/src/pages/docs/sections/quickstart.tsx",
    ["is the short-circuit answer", "A valid response includes the payload"],
    "Kit quickstart must not overstate isValid or optional payload enrichment",
  );
  expectIncludes(
    "packages/kit/src/pages/docs/sections/ai-assistants.tsx",
    [
      "versioned summaries maintained with the canonical API",
      "canonical implementation and docs take",
    ],
    "Kit assistant docs must identify canonical sources",
  );
  expectNotIncludes(
    "packages/kit/src/pages/docs/sections/ai-assistants.tsx",
    ["never hand-edited", "regenerated alongside"],
    "Kit assistant docs must not claim nonexistent generation automation",
  );
  expectIncludes(
    ".github/workflows/release.yml",
    [
      "Release the native-derived current spec version",
      "release-branch-policy.mjs guard docs",
      "release-branch-policy.mjs assert-floor",
      "Native-derived spec version",
      'if git rev-parse --verify "refs/tags/$TAG_NAME" >/dev/null 2>&1; then',
      'TAG_COMMIT=$(git rev-parse "refs/tags/$TAG_NAME^{commit}")',
      "HEAD_COMMIT=$(git rev-parse HEAD)",
      "A released spec tag is immutable",
      "allowing an idempotent rerun",
    ],
    "docs release workflow derived spec policy",
  );
  expectNotIncludes(
    ".github/workflows/release.yml",
    [
      "git pull --rebase origin main",
      "git commit",
      "'.spec = $version'",
      "- patch",
      "- minor",
      "- major",
    ],
    "docs release workflow must not mutate the derived spec",
  );
  for (const [releaseWorkflow, nativePackage] of [
    [".github/workflows/release-apple.yml", "apple"],
    [".github/workflows/release-google.yml", "google"],
  ]) {
    expectIncludes(
      releaseWorkflow,
      [
        "openiap-versions.json|packages/*/openiap-versions.json|packages/gql/package.json|packages/docs/package.json|packages/google/package.json|packages/apple/package.json",
        "git show HEAD:openiap-versions.json > /tmp/upstream-openiap-versions.json",
        "Re-sync package metadata and docs copy after merge",
        "./scripts/sync-release-generated.sh",
        "packages/docs/src/generated/version-metadata.json",
        "packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json",
        `update-native ${nativePackage} "$VERSION"`,
        "clean rebase can combine independent Apple and Google bumps",
        "git commit --amend --no-edit",
        "release-branch-policy.mjs assert-floor",
      ],
      `${releaseWorkflow} must commit package metadata synced from openiap-versions.json`,
    );
    const releaseWorkflowSource = read(releaseWorkflow);
    if (
      releaseWorkflowSource.split(`update-native ${nativePackage} "$VERSION"`)
        .length -
        1 !==
      3
    ) {
      fail(
        `${releaseWorkflow} must derive the spec in its normal, rebase-conflict, and pre-push convergence paths`,
      );
    }
    expectNotIncludes(
      releaseWorkflow,
      [
        "cp openiap-versions.json packages/docs/openiap-versions.json",
        'git show HEAD:"$conflict_file"',
        "/tmp/theirs.json",
      ],
      `${releaseWorkflow} must not only sync the docs copy after conflict resolution`,
    );
  }
  for (const releaseWorkflow of [
    ".github/workflows/release-apple.yml",
    ".github/workflows/release-google.yml",
    ".github/workflows/release-expo.yml",
    ".github/workflows/release-react-native.yml",
    ".github/workflows/release-flutter.yml",
    ".github/workflows/release-godot.yml",
    ".github/workflows/release-kmp.yml",
    ".github/workflows/release-maui.yml",
  ]) {
    expectIncludes(
      releaseWorkflow,
      ["sync-release-generated.sh"],
      `${releaseWorkflow} must regenerate release-derived files (version metadata, llms, agent context) inside the version-bump commit`,
    );
  }
  expectIncludes(
    ".github/workflows/release-apple.yml",
    [
      "COCOAPODS_VERSION: 1.15.2",
      'gem install cocoapods -v "$COCOAPODS_VERSION"',
      "bare_exists=true",
      "bare_exists=false",
      "Checkout release tag (current version)",
      'LEGACY_TAG="apple-v$VERSION"',
      "steps.check_tag.outputs.bare_exists != 'true'",
      "Cleaning up tag created by this run",
    ],
    "Apple release workflow must not delete pre-existing tags on validation failure",
  );
  expectNotIncludes(
    ".github/workflows/release-apple.yml",
    ["gem install cocoapods\n"],
    "Apple release workflow must pin CocoaPods",
  );
  expectIncludes(
    ".github/workflows/release-google.yml",
    [
      "release:",
      "runs-on: ubuntu-latest",
      "./gradlew :openiap:assembleRelease --no-daemon --stacktrace",
      "artifacts=(openiap/build/outputs/aar/*.aar openiap/build/libs/*.jar)",
      "No Google release artifacts found",
      'cp "${artifacts[@]}" release-artifacts/',
      "Checkout release tag (current version)",
      'LEGACY_TAG="google-v$VERSION"',
      "ORG_GRADLE_PROJECT_SONATYPE_CLOSE_TIMEOUT_SECONDS: '3600'",
      'ARTIFACT_URL="https://repo1.maven.org/maven2/io/github/hyochan/openiap/openiap-google-horizon/$VERSION/openiap-google-horizon-$VERSION.pom"',
      'ARTIFACT_URL="https://repo1.maven.org/maven2/io/github/hyochan/openiap/openiap-google-amazon/$VERSION/openiap-google-amazon-$VERSION.pom"',
      'ARTIFACT_URL="https://repo1.maven.org/maven2/io/github/hyochan/openiap/openiap-google/$VERSION/openiap-google-$VERSION.pom"',
      'HTTP_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$ARTIFACT_URL" || true)',
      'HTTP_STATUS="${HTTP_STATUS:-000}"',
      "Unable to verify openiap-google-horizon $VERSION on Maven Central",
      "Unable to verify openiap-google-amazon $VERSION on Maven Central",
      "Unable to verify openiap-google $VERSION on Maven Central",
      'if gh release view "google-$VERSION" >/dev/null 2>&1; then',
      'gh release edit "google-$VERSION"',
      'gh release upload "google-$VERSION" $ARTIFACTS --clobber',
    ],
    "Google release workflow must not require a macOS runner",
  );
  for (const [frameworkReleaseWorkflow, packageId, tagCommand] of [
    [
      ".github/workflows/release-expo.yml",
      "expo",
      'git tag -a "$RELEASE_TAG" "$GITHUB_SHA"',
    ],
    [
      ".github/workflows/release-react-native.yml",
      "react-native",
      'git tag -a "$RELEASE_TAG" "$GITHUB_SHA"',
    ],
    [
      ".github/workflows/release-flutter.yml",
      "flutter",
      'git tag -a "$RELEASE_TAG" "$GITHUB_SHA"',
    ],
    [
      ".github/workflows/release-godot.yml",
      "godot",
      'git tag -a "$RELEASE_TAG" "$GITHUB_SHA"',
    ],
  ]) {
    expectIncludes(
      frameworkReleaseWorkflow,
      [
        "Check if release tag already exists",
        "Checkout release tag (current version)",
        'git checkout "$RELEASE_TAG"',
        "Use 'current' to retry this version.",
        `release-branch-policy.mjs guard ${packageId}`,
        "RELEASE_BRANCH: ${{ github.ref_name }}",
        "Commit version update",
        "assert-release-head.mjs",
        '"$RELEASE_BRANCH" "$GITHUB_SHA"',
        tagCommand,
        'git push --atomic origin "HEAD:$RELEASE_BRANCH" --follow-tags',
        'git commit --allow-empty -m "chore: recover release ref"',
        '"HEAD:refs/heads/$RELEASE_BRANCH"',
        '"refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
      ],
      `${frameworkReleaseWorkflow} must tag only the verified dispatch head`,
    );
    expectNotIncludes(
      frameworkReleaseWorkflow,
      [
        "STASHED=false",
        'git stash push --include-untracked -m "release artifacts"',
        'git pull --rebase origin "$RELEASE_BRANCH"',
        "git stash --include-untracked",
        "git stash pop || true",
        "git push --follow-tags",
        'git push origin "HEAD:$RELEASE_BRANCH" --follow-tags',
        "git tag -af",
        'git push origin "flutter-iap-${NEW_VERSION}" --force',
        "create_release:",
        "inputs.create_release",
      ],
      `${frameworkReleaseWorkflow} must not incorporate unverified branch changes`,
    );
  }
  expectIncludes(
    "scripts/assert-release-head.mjs",
    [
      '"ls-remote", "--exit-code", "origin", ref',
      "remoteHead !== expectedHead",
      "review, CI, and E2E evidence matches the published source",
    ],
    "framework release head guard",
  );
  expectIncludes(
    "scripts/assert-release-tag.mjs",
    [
      'runGit(["show", `${tag}:${config.path}`])',
      '"ls-remote"',
      "`refs/tags/${tag}^{}`",
      '"merge-base", "--is-ancestor"',
      "metadata version is",
      "does not match its immutable origin tag commit",
      "is not reachable from origin/",
    ],
    "existing release tag provenance guard",
  );
  expectIncludes(
    ".github/workflows/release-apple.yml",
    [
      "SKIP_VERSION_COMMIT: ${{ steps.version.outputs.skip_version_commit }}",
      'if [ "$SKIP_VERSION_COMMIT" = "true" ]; then',
      "Use 'current' to retry with existing version.",
    ],
    "Apple release must reject existing tags outside a current retry",
  );
  const appleExistingTagCheck = extractRunBlockContaining(
    read(".github/workflows/release-apple.yml"),
    "Use 'current' to retry with existing version.",
  );
  const appleTagBranches = extractAppleExistingTagBranches(
    appleExistingTagCheck,
  );
  if (!appleTagBranches) {
    fail(
      "Apple release must reject both existing bare and legacy tags outside a current retry",
    );
  } else {
    for (const [name, branch] of Object.entries(appleTagBranches)) {
      const expectedError = new RegExp(
        `${name === "legacy" ? "Legacy tag apple-v" : "Tag "}\\$VERSION already exists\\. Use 'current' to retry with existing version\\.`,
      );
      if (
        !/if \[ "\$SKIP_VERSION_COMMIT" = "true" \]; then/.test(branch) ||
        !expectedError.test(branch) ||
        findExecutableLineIndex(branch, /^\s*exit 1\s*$/) < 0
      ) {
        fail(
          `Apple ${name} existing-tag branch must execute exit 1 outside a current retry`,
        );
      }
    }
  }
  for (const [frameworkReleaseWorkflow, packageId] of [
    [".github/workflows/release-apple.yml", "apple"],
    [".github/workflows/release-google.yml", "google"],
    [".github/workflows/release-expo.yml", "expo"],
    [".github/workflows/release-react-native.yml", "react-native"],
    [".github/workflows/release-flutter.yml", "flutter"],
    [".github/workflows/release-godot.yml", "godot"],
    [".github/workflows/release-kmp.yml", "kmp"],
    [".github/workflows/release-maui.yml", "maui"],
  ]) {
    expectIncludes(
      frameworkReleaseWorkflow,
      ["assert-release-tag.mjs", `${packageId} \"$RELEASE_BRANCH\"`],
      `${frameworkReleaseWorkflow} must validate existing tag provenance`,
    );
    const workflowSource = read(frameworkReleaseWorkflow);
    if (
      workflowSource.indexOf("assert-release-tag.mjs") >
      workflowSource.indexOf("git checkout")
    ) {
      fail(
        `${frameworkReleaseWorkflow} must validate existing tag provenance before checkout`,
      );
    }
  }
  for (const [frameworkReleaseWorkflow, packageId] of [
    [".github/workflows/release-apple.yml", "apple"],
    [".github/workflows/release-google.yml", "google"],
    [".github/workflows/release-expo.yml", "expo"],
    [".github/workflows/release-react-native.yml", "react-native"],
    [".github/workflows/release-flutter.yml", "flutter"],
  ]) {
    const existingTagRunBlock = extractRunBlockContaining(
      read(frameworkReleaseWorkflow),
      "assert-release-tag.mjs",
    );
    const guardIndex = findExecutableLineIndex(
      existingTagRunBlock,
      /^\s*node\b.*assert-release-tag\.mjs"?\s*\\\s*$/,
    );
    const packageIndex = findExecutableLineIndex(
      existingTagRunBlock,
      new RegExp(`^\\s*${packageId} "\\$RELEASE_BRANCH"`),
      guardIndex + 1,
    );
    const checkoutIndex = findExecutableLineIndex(
      existingTagRunBlock,
      /^\s*git checkout\b/,
      packageIndex + 1,
    );
    if (!(
      guardIndex >= 0 &&
      packageIndex === guardIndex + 1 &&
      checkoutIndex > packageIndex
    )) {
      fail(
        `${frameworkReleaseWorkflow} must guard and check out the existing tag in one shell block`,
      );
    }
  }
  for (const [frameworkReleaseWorkflow, expectedIf] of [
    [
      ".github/workflows/release-apple.yml",
      "if: steps.version.outputs.skip_version_commit == 'true' && steps.check_tag.outputs.exists == 'true'",
    ],
    [
      ".github/workflows/release-google.yml",
      "if: steps.version.outputs.skip_version_commit == 'true' && steps.check_tag.outputs.exists == 'true'",
    ],
    [
      ".github/workflows/release-expo.yml",
      "if: ${{ inputs.version == 'current' }}",
    ],
    [
      ".github/workflows/release-react-native.yml",
      "if: ${{ inputs.version == 'current' }}",
    ],
    [
      ".github/workflows/release-flutter.yml",
      "if: ${{ inputs.version == 'current' }}",
    ],
  ]) {
    const tagStep = extractNamedWorkflowStep(
      read(frameworkReleaseWorkflow),
      "Checkout release tag (current version)",
    );
    const tagStepIf = tagStep?.source
      .split("\n")
      .find((line) => line.trim().startsWith("if:"))
      ?.trim();
    const guardIndex = tagStep
      ? findExecutableLineIndex(
          tagStep.source,
          /^\s*node\b.*assert-release-tag\.mjs"?\s*\\\s*$/,
        )
      : -1;
    const checkoutIndex = tagStep
      ? findExecutableLineIndex(
          tagStep.source,
          /^\s*git checkout\b/,
          guardIndex + 1,
        )
      : -1;
    if (
      !tagStep ||
      tagStepIf !== expectedIf ||
      guardIndex < 0 ||
      checkoutIndex <= guardIndex
    ) {
      fail(
        `${frameworkReleaseWorkflow} must condition and execute its existing-tag guard before checkout`,
      );
    }
  }
  for (const [frameworkReleaseWorkflow, expectedIf] of [
    [
      ".github/workflows/release-godot.yml",
      "if: ${{ inputs.version == 'current' && steps.check_tag.outputs.exists == 'true' }}",
    ],
    [
      ".github/workflows/release-kmp.yml",
      "if: ${{ inputs.version == 'current' && steps.check_tag.outputs.exists == 'true' }}",
    ],
    [
      ".github/workflows/release-maui.yml",
      "if: steps.version.outputs.skip_version_commit == 'true' && steps.check_tag.outputs.exists == 'true'",
    ],
  ]) {
    const workflowSource = read(frameworkReleaseWorkflow);
    const guardStep = extractNamedWorkflowStep(
      workflowSource,
      "Verify current release tag provenance",
    );
    const checkoutStep = extractNamedWorkflowStep(
      workflowSource,
      "Checkout release tag (current version)",
    );
    const guardIf = guardStep?.source
      .split("\n")
      .find((line) => line.trim().startsWith("if:"))
      ?.trim();
    const checkoutIf = checkoutStep?.source
      .split("\n")
      .find((line) => line.trim().startsWith("if:"))
      ?.trim();
    if (
      !guardStep ||
      !checkoutStep ||
      guardIf !== expectedIf ||
      checkoutIf !== expectedIf ||
      findExecutableLineIndex(
        guardStep.source,
        /^\s*node\b.*assert-release-tag\.mjs"?\s*\\\s*$/,
      ) < 0 ||
      findExecutableLineIndex(checkoutStep.source, /^\s*git checkout\b/) < 0 ||
      guardStep.endIndex !== checkoutStep.startIndex
    ) {
      fail(
        `${frameworkReleaseWorkflow} must place an identically conditioned provenance guard immediately before existing-tag checkout`,
      );
    }
  }
  for (const frameworkReleaseWorkflow of [
    ".github/workflows/release-react-native.yml",
    ".github/workflows/release-expo.yml",
    ".github/workflows/release-flutter.yml",
  ]) {
    expectIncludes(
      frameworkReleaseWorkflow,
      [
        "Assert verified release head is unchanged",
        "if: ${{ inputs.version != 'current' || steps.check_tag.outputs.exists != 'true' }}",
      ],
      `${frameworkReleaseWorkflow} must skip the branch-only head helper after checking out an existing release tag`,
    );
  }
  for (const frameworkReleaseWorkflow of [
    ".github/workflows/release-kmp.yml",
    ".github/workflows/release-maui.yml",
  ]) {
    expectIncludes(
      frameworkReleaseWorkflow,
      [
        "assert-release-head.mjs",
        '"$RELEASE_BRANCH" "$GITHUB_SHA"',
        "published without a provenance tag",
        'git commit --allow-empty -m "chore: recover release ref"',
        'TAG_TARGET="$GITHUB_SHA"',
        "git push --atomic origin",
        '"HEAD:$RELEASE_BRANCH"',
        '"refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
      ],
      `${frameworkReleaseWorkflow} must reject a stale dispatch head`,
    );
    expectNotIncludes(
      frameworkReleaseWorkflow,
      [
        'git pull --rebase origin "$RELEASE_BRANCH"',
        'git push origin "HEAD:$RELEASE_BRANCH"',
        'git push origin "$RELEASE_TAG"',
      ],
      `${frameworkReleaseWorkflow} must not incorporate unverified branch changes`,
    );
  }
  expectIncludes(
    ".github/workflows/release-kmp.yml",
    ["inputs.version != 'current' || steps.check_tag.outputs.exists != 'true'"],
    "KMP current-mode release must verify an untagged dispatch head",
  );
  expectIncludes(
    ".github/workflows/release-maui.yml",
    [
      "steps.version.outputs.skip_version_commit != 'true' || steps.check_tag.outputs.exists != 'true'",
      "Check if NuGet package already published",
      "Unable to verify OpenIap.Maui $VERSION on NuGet.org",
      "if: steps.check_nuget.outputs.exists == 'false'",
      "NUGET_API_KEY secret is required",
    ],
    "MAUI current-mode release must verify an untagged dispatch head",
  );
  for (const [npmReleaseWorkflow, npmPackage] of [
    [".github/workflows/release-expo.yml", "expo-iap"],
    [".github/workflows/release-react-native.yml", "react-native-iap"],
  ]) {
    expectIncludes(
      npmReleaseWorkflow,
      [
        "Check if npm package already published",
        "npm install -g npm@11.19.0",
        `npm view "${npmPackage}@$VERSION" version`,
        `if NPM_OUTPUT=$(npm view "${npmPackage}@$VERSION" version 2>&1); then`,
        "grep -qiE 'E404|404 Not Found'",
        "Refuse an untagged published version",
        "published without a provenance tag",
        "publish_only:",
        "source_run_id:",
        "if: ${{ !inputs.publish_only }}",
        "group: ${{ github.workflow }}-${{ inputs.publish_only && 'publish' || 'release' }}",
        "Dispatch npm publish on tag ref",
        "Require tag-ref npm publisher capability",
        `if ! git -C "$GITHUB_WORKSPACE" grep -q '^  publish-npm:' "$TAG" -- ${npmReleaseWorkflow}`,
        '! git -C "$GITHUB_WORKSPACE" cat-file -e "$TAG:scripts/npm-publish-authorization.mjs"',
        "Upload npm publish authorization",
        "actions/upload-artifact@v4",
        "npm-publish-authorization-${{ github.run_attempt }}",
        "predates the tag-ref npm publisher and cannot be retried safely",
        "gh workflow run release-",
        '--ref "$TAG"',
        "-f publish_only=true",
        '-f source_run_id="$GITHUB_RUN_ID"',
        "publish-npm:",
        "if: ${{ inputs.publish_only }}",
        "actions: read",
        "fetch-depth: 0",
        'if [ "$GITHUB_REF" != "$EXPECTED_REF" ]; then',
        'if [ "$(git rev-parse HEAD)" != "$GITHUB_SHA" ]; then',
        'git merge-base --is-ancestor "$GITHUB_SHA" "origin/$SOURCE_BRANCH"',
        "Require successful source release run",
        "actions/runs/$SOURCE_RUN_ID",
        'SOURCE_CONCLUSION" != "success"',
        "Verify source run authorized this release tag",
        'gh run download "$SOURCE_RUN_ID"',
        'npm-publish-authorization.mjs" verify',
        "verify-npm-release-provenance.mjs",
        "Verify existing npm release provenance",
        "Assert npm publish source is unchanged",
        "Verify published npm release provenance",
        "if: steps.check_npm.outputs.exists == 'false'",
      ],
      `${npmReleaseWorkflow} must support npm release reruns`,
    );
    expectNotIncludes(
      npmReleaseWorkflow,
      [
        "npm install -g npm@latest",
        "node-version: 20.x",
        "set +e",
        "NPM_STATUS=$?",
        "gitHead 2>/dev/null || true",
      ],
      `${npmReleaseWorkflow} must not drift npm trusted-publishing CLI version`,
    );
    const npmReleaseSource = read(npmReleaseWorkflow);
    const publishedProvenanceStep = extractNamedWorkflowStep(
      npmReleaseSource,
      "Verify published npm release provenance",
    );
    if (
      !publishedProvenanceStep ||
      !publishedProvenanceStep.source.includes(
        "Allow five minutes for the immutable provenance to propagate",
      ) ||
      !/^\s*for attempt in \{1\.\.30\}; do\s*$/mu.test(
        publishedProvenanceStep.source,
      ) ||
      !/^\s*sleep 10\s*$/mu.test(publishedProvenanceStep.source)
    ) {
      fail(
        `${npmReleaseWorkflow} must wait up to five minutes for npm provenance inside its published-provenance step`,
      );
    }
    if (
      npmReleaseSource.indexOf(
        "- name: Check if npm package already published",
      ) > npmReleaseSource.indexOf("git tag -a")
    ) {
      fail(
        `${npmReleaseWorkflow} must verify npm before creating a missing tag`,
      );
    }
    const recoveryPushIndex = npmReleaseSource.indexOf(
      '"refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
    );
    const legacyGuardIndex = npmReleaseSource.indexOf(
      "- name: Require tag-ref npm publisher capability",
    );
    const authorizationWriteIndex = npmReleaseSource.indexOf(
      "- name: Write npm publish authorization",
    );
    const authorizationUploadIndex = npmReleaseSource.indexOf(
      "- name: Upload npm publish authorization",
    );
    const dispatchIndex = npmReleaseSource.indexOf(
      "- name: Dispatch npm publish on tag ref",
    );
    const workflowDispatchCommandIndex = npmReleaseSource.indexOf(
      "gh workflow run release-",
    );
    const publishJobIndex = npmReleaseSource.indexOf("\n  publish-npm:\n");
    const tagGuardIndex = npmReleaseSource.indexOf(
      'if [ "$GITHUB_REF" != "$EXPECTED_REF" ]; then',
    );
    const sourceRunGuardIndex = npmReleaseSource.indexOf(
      "- name: Require successful source release run",
    );
    const sourceAuthorizationIndex = npmReleaseSource.indexOf(
      "- name: Verify source run authorized this release tag",
    );
    const finalSourceGuardIndex = npmReleaseSource.indexOf(
      "- name: Assert npm publish source is unchanged",
    );
    const publishIndex = npmReleaseSource.indexOf("- name: Publish to npm");
    const publishedProvenanceIndex = npmReleaseSource.indexOf(
      "- name: Verify published npm release provenance",
    );
    if (
      recoveryPushIndex >= legacyGuardIndex ||
      legacyGuardIndex >= authorizationWriteIndex ||
      authorizationWriteIndex >= authorizationUploadIndex ||
      authorizationUploadIndex >= dispatchIndex ||
      dispatchIndex >= workflowDispatchCommandIndex ||
      workflowDispatchCommandIndex >= publishJobIndex ||
      publishJobIndex >= tagGuardIndex ||
      tagGuardIndex >= sourceRunGuardIndex ||
      sourceRunGuardIndex >= sourceAuthorizationIndex ||
      sourceAuthorizationIndex >= finalSourceGuardIndex ||
      finalSourceGuardIndex >= publishIndex ||
      publishIndex >= publishedProvenanceIndex
    ) {
      fail(
        `${npmReleaseWorkflow} must publish in a tag-ref OIDC run after the immutable tag push`,
      );
    }
    if ((npmReleaseSource.match(/id-token: write/g) ?? []).length !== 1) {
      fail(
        `${npmReleaseWorkflow} must grant OIDC only to its tag-ref npm publisher`,
      );
    }
    if (npmReleaseSource.includes('git checkout --detach "$GITHUB_SHA"')) {
      fail(
        `${npmReleaseWorkflow} must not substitute checkout state for tag-ref OIDC provenance`,
      );
    }
  }
  expectIncludes(
    "scripts/verify-npm-release-provenance.mjs",
    [
      "npm gitHead mismatch",
      "https://slsa.dev/provenance/v1",
      "resolvedDependencies",
      "subject?.name === expectedSubject",
      "subject?.digest?.sha512?.toLowerCase() === expectedArtifactDigest",
      "workflow?.path === expectedWorkflowPath",
      "workflow?.ref === expectedRef",
      "workflow?.repository === expectedRepository",
      "dependency?.digest?.gitCommit === expectedCommit",
      "statement?._type === IN_TOTO_STATEMENT_V1",
      "verifiedEntry?.attestationBundles",
      "new URL(entry?.registry).origin",
      '["audit", "signatures", "--json", "--include-attestations"]',
      "verifyNpmSignatureAuditResult",
    ],
    "npm release provenance verifier must bind registry metadata and SLSA provenance to the immutable tag",
  );
  expectIncludes(
    "scripts/npm-publish-authorization.mjs",
    [
      "sourceRunId",
      "sourceRunAttempt",
      "sourceHeadSha",
      "tagSha",
      "npm publish authorization",
    ],
    "npm tag publisher authorization must bind the exact source run to the exact tag commit",
  );
  expectIncludes(
    ".github/workflows/ci.yml",
    [
      "scripts/npm-publish-authorization.test.mjs",
      "scripts/verify-npm-release-provenance.test.mjs",
    ],
    "CI must test npm release provenance verification",
  );
  expectIncludes(
    ".github/workflows/release-flutter.yml",
    [
      "Check if pub.dev package already published",
      "Unable to verify flutter_inapp_purchase $VERSION on pub.dev",
      "Refuse an untagged published version",
      "published without a provenance tag",
    ],
    "Flutter release must verify pub.dev before creating a missing tag",
  );
  const flutterReleaseSource = read(".github/workflows/release-flutter.yml");
  if (
    flutterReleaseSource.indexOf(
      "- name: Check if pub.dev package already published",
    ) > flutterReleaseSource.indexOf("git tag -a")
  ) {
    fail("Flutter release must verify pub.dev before creating a missing tag");
  }
  expectIncludes(
    "scripts/verify-npm-consumer-install.mjs",
    [
      "npm",
      "pack",
      "--pack-destination",
      "--ignore-scripts",
      "openiap-versions.json must be packed as a real file",
      "consumer install smoke test passed",
    ],
    "npm consumer install smoke helper",
  );
  for (const [packageJsonPath, packageName] of [
    ["libraries/expo-iap/package.json", "expo-iap"],
    ["libraries/react-native-iap/package.json", "react-native-iap"],
  ]) {
    expectIncludes(
      packageJsonPath,
      [
        '"verify:consumer-install"',
        "verify-npm-consumer-install.mjs",
        `--package-name ${packageName}`,
        "--required openiap-versions.json",
      ],
      `${packageJsonPath} must expose npm consumer smoke test`,
    );
  }
  expectIncludes(
    "libraries/react-native-iap/package.json",
    ['"prepare": "tsx scripts/check-nitro-versions.ts', '"tsx": "^4.23.11"'],
    "React Native prepare must use the locked local tsx binary",
  );
  expectNotIncludes(
    "libraries/react-native-iap/package.json",
    ["npx tsx"],
    "React Native prepare must not download an unpinned tsx at release time",
  );
  for (const [workflowPath, command] of [
    [".github/workflows/ci-expo-iap.yml", "bun run verify:consumer-install"],
    [
      ".github/workflows/ci-react-native-iap.yml",
      "yarn verify:consumer-install",
    ],
    [
      ".github/workflows/release-expo.yml",
      "bun run verify:consumer-install --pack-ignore-scripts",
    ],
    [
      ".github/workflows/release-react-native.yml",
      "verify:consumer-install --pack-ignore-scripts",
    ],
  ]) {
    expectIncludes(
      workflowPath,
      ["Consumer install smoke test", command],
      `${workflowPath} must run npm consumer smoke test`,
    );
  }
  expectIncludes(
    ".github/workflows/publish-flutter.yml",
    [
      "push:",
      "tags:",
      '"flutter-iap-*"',
      'EXPECTED_REF="refs/tags/flutter-iap-${VERSION}"',
      "GITHUB_EVENT_NAME",
      "GITHUB_REF_TYPE",
      "HEAD_COMMIT",
      "GITHUB_SHA",
      "actions: read",
      "fetch-depth: 0",
      'git merge-base --is-ancestor "$GITHUB_SHA" "origin/$RELEASE_BRANCH"',
      'AUTHORIZATION_NAME="flutter-publish-authorization-$GITHUB_SHA"',
      "actions/artifacts?name=$AUTHORIZATION_NAME",
      'SOURCE_WORKFLOW_PATH" != ".github/workflows/release-flutter.yml"',
      'gh run download "$SOURCE_RUN_ID"',
      "SOURCE_RUN_ATTEMPT=$(jq -r '.sourceRunAttempt // \"\"'",
      "actions/runs/$SOURCE_RUN_ID/attempts/$SOURCE_RUN_ATTEMPT",
      'SOURCE_RUN_ATTEMPT_ACTUAL" != "$SOURCE_RUN_ATTEMPT"',
      'npm-publish-authorization.mjs" verify',
      "Check if pub.dev package already published",
      'flutter-version: "3.44.9"',
      'HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}"',
      'HTTP_STATUS="${HTTP_STATUS:-000}"',
      "https://pub.dev/api/packages/flutter_inapp_purchase/versions/$VERSION",
      "if: steps.check_pub.outputs.exists == 'false'",
    ],
    "Flutter publish workflow must support pub.dev release reruns",
  );
  expectNotIncludes(
    ".github/workflows/publish-flutter.yml",
    ["environment: pub.dev"],
    "Flutter publishing must not require an unconfigured GitHub environment",
  );
  expectNotIncludes(
    ".github/workflows/publish-flutter.yml",
    ["workflow_dispatch:"],
    "Flutter pub.dev publishing must only run from an eligible tag-push event",
  );
  expectIncludes(
    ".github/workflows/release-flutter.yml",
    [
      "Wait for tag-push pub.dev publisher",
      'git -C "$GITHUB_WORKSPACE" grep -q "Verify release workflow authorization" "$TAG" --',
      ".github/workflows/publish-flutter.yml ||",
      '! git -C "$GITHUB_WORKSPACE" cat-file -e "$TAG:scripts/npm-publish-authorization.mjs"',
      "Write Flutter publish authorization",
      "Upload Flutter publish authorization",
      "flutter-publish-authorization-${{ steps.flutter_auth.outputs.tag_sha }}",
      "overwrite: true",
      "retention-days: 90",
      "predates the authorized tag-push publisher and cannot be retried safely",
      'AUTHORIZATION_NAME="flutter-publish-authorization-$TAG_COMMIT"',
      "AUTHORIZATION_COUNT",
      "select(.expired == false)",
      "event=push&head_sha=$TAG_COMMIT",
      'gh run rerun "$RUN_ID"',
      "pub.dev rejects workflow_dispatch publishing",
    ],
    "Flutter release must authorize, wait for, or rerun the original tag-push publisher",
  );
  expectNotIncludes(
    ".github/workflows/release-flutter.yml",
    ["gh workflow run publish-flutter.yml"],
    "Flutter release must not replace the pub.dev-required tag-push event with workflow_dispatch",
  );
  for (const flutterWorkflow of [
    ".github/workflows/ci-flutter-inapp-purchase.yml",
    ".github/workflows/release-flutter.yml",
    ".github/workflows/publish-flutter.yml",
  ]) {
    expectIncludes(
      flutterWorkflow,
      ['flutter-version: "3.44.9"'],
      `${flutterWorkflow} must pin Flutter SDK`,
    );
    expectNotIncludes(
      flutterWorkflow,
      ['flutter-version: "3.x"'],
      `${flutterWorkflow} must not float Flutter SDK`,
    );
    expectNotIncludes(
      flutterWorkflow,
      ['flutter-version: "3.41.9"', 'flutter-version: "3.44.0"'],
      `${flutterWorkflow} must not use a superseded Flutter toolchain`,
    );
  }
  expectIncludes(
    ".claude/commands/review-pr.md",
    [
      "~300 seconds (5 minutes)",
      "5-minute wake-up",
      "CodeRabbit is the only configured external reviewer",
      "clean CodeRabbit result is successful reviewer coverage",
      "one complete",
      "`$review-self` round",
      "### Cleanup Review Automation Comments",
      '.body == "@coderabbitai review"',
      'or (.user.login == "coderabbitai[bot]" and (.body | contains("CodeRabbit review command invocation")))',
      'test("review (was )?skipped|review unavailable|unable to review|too many files|file limit"; "i")',
      "Do **not** delete human comments, inline review replies, actual reviewer summaries, CodeRabbit walkthrough comments, or any comment containing substantive review feedback",
    ],
    "review-pr must preserve the requested five-minute polling cadence",
  );
  expectNotIncludes(
    ".claude/commands/review-pr.md",
    [
      "~480 seconds (8 minutes)",
      "8-minute wake-up",
      "/gemini review",
      "Copilot",
    ],
    "review-pr must not retain superseded cadence or reviewer triggers",
  );
  for (const workflowSkill of [
    ".codex/skills/openiap-workflows/SKILL.md",
    ".claude/skills/openiap-workflows/SKILL.md",
  ]) {
    expectIncludes(
      workflowSkill,
      ["CodeRabbit", "review-self"],
      `${workflowSkill} must route unavailable CodeRabbit review to review-self`,
    );
  }
  expectIncludes(
    ".claude/commands/release.md",
    [
      "currently every five minutes",
      "`npm run deploy`; run `release.yml` with `version=current` only when",
      "then run the docs deployment. Run the Docs release workflow with",
      "only when the native-derived `spec` advanced",
      "immutable existing `docs-{spec}` tag is never reused",
      "If a Docs GitHub Release is requested while",
      "stop and explain that the immutable",
    ],
    "dependency release gate must preserve review cadence and conditional Docs releases",
  );
  expectNotIncludes(
    ".claude/commands/release.md",
    [
      "currently about eight minutes",
      "`npm run deploy`, then `release.yml`",
      "then run the docs deployment and the Docs release workflow",
      "or the maintainer explicitly requested",
    ],
    "dependency release gate must not unconditionally reuse a Docs release tag",
  );
  for (const releaseNotesWorkflow of [
    ".github/workflows/release-apple.yml",
    ".github/workflows/release-google.yml",
    ".github/workflows/release-kmp.yml",
    ".github/workflows/release-maui.yml",
    ".github/workflows/release-expo.yml",
    ".github/workflows/release-react-native.yml",
    ".github/workflows/release-flutter.yml",
    ".github/workflows/release-godot.yml",
  ]) {
    expectIncludes(
      releaseNotesWorkflow,
      ['RELEASE_REF="HEAD"', "..$RELEASE_REF"],
      `${releaseNotesWorkflow} release notes must use the release tag when it already exists`,
    );
  }
  for (const xcodeReleaseWorkflow of [
    ".github/workflows/ci.yml",
    ".github/workflows/release-apple.yml",
    ".github/workflows/release-kmp.yml",
  ]) {
    expectIncludes(
      xcodeReleaseWorkflow,
      [
        "runs-on: macos-15",
        "XCODE_VERSION: 16.4",
        "maxim-lobanov/setup-xcode@v1",
        "xcode-version: ${{ env.XCODE_VERSION }}",
      ],
      `${xcodeReleaseWorkflow} must pin the macOS/Xcode release image`,
    );
    expectNotIncludes(
      xcodeReleaseWorkflow,
      ["runs-on: macos-latest", "sudo xcode-select -s /Applications/Xcode.app"],
      `${xcodeReleaseWorkflow} must not drift with macos-latest Xcode`,
    );
  }
  expectIncludes(
    ".github/workflows/release-expo.yml",
    [
      "Expo SDK 57's expo-modules-jsi package declares Swift tools 6.2",
      "runs-on: macos-26",
      'XCODE_VERSION: "26.6"',
      "maxim-lobanov/setup-xcode@v1",
      "xcode-version: ${{ env.XCODE_VERSION }}",
    ],
    "Expo release must use an Xcode version that can parse Expo SDK 57 Swift 6.2 manifests",
  );
  expectNotIncludes(
    ".github/workflows/release-expo.yml",
    ["XCODE_VERSION: 16.4"],
    "Expo release must not regress to Xcode 16.4 and Swift 6.1",
  );
  expectIncludes(
    ".github/workflows/ci-maui-iap.yml",
    [
      "app-store-artifact:",
      "runs-on: macos-26",
      'APP_STORE_XCODE_VERSION: "26.6"',
      'APP_STORE_SDK_VERSION: "26.5"',
      'APP_STORE_LD_VERSION: "1267.0"',
      "maxim-lobanov/setup-xcode@v1",
      "xcode-version: ${{ env.APP_STORE_XCODE_VERSION }}",
      "bash packages/apple/scripts/verify-app-store-xcframework.sh",
      "runs-on: xcode-27",
    ],
    "MAUI CI must separate stable App Store artifacts from Xcode 27 compatibility validation",
  );
  expectIncludes(
    ".github/workflows/release-maui.yml",
    [
      "runs-on: macos-26",
      'APP_STORE_XCODE_VERSION: "26.6"',
      'APP_STORE_SDK_VERSION: "26.5"',
      'APP_STORE_LD_VERSION: "1267.0"',
      "maxim-lobanov/setup-xcode@v1",
      "xcode-version: ${{ env.APP_STORE_XCODE_VERSION }}",
      "bash packages/apple/scripts/verify-app-store-xcframework.sh",
      "runs-on: xcode-27",
    ],
    "MAUI release must publish with the stable App Store toolchain and retain Xcode 27 validation",
  );
  for (const mauiXcodeWorkflow of [
    ".github/workflows/ci-maui-iap.yml",
    ".github/workflows/release-maui.yml",
  ]) {
    expectNotIncludes(
      mauiXcodeWorkflow,
      ["runs-on: macos-latest"],
      `${mauiXcodeWorkflow} must not drift with macos-latest Xcode`,
    );
  }
  expectIncludes(
    "packages/apple/scripts/verify-app-store-xcframework.sh",
    [
      'EXPECTED_XCODE_VERSION="${APP_STORE_XCODE_VERSION:-26.6}"',
      'EXPECTED_SDK_VERSION="${APP_STORE_SDK_VERSION:-26.5}"',
      'EXPECTED_LD_VERSION="${APP_STORE_LD_VERSION:-1267.0}"',
      "xcrun vtool -show-build",
      "version[[:space:]]+27[0-9]+",
      '$1 == "cmd" && $2 == "LC_BUILD_VERSION"',
      'expect_ld_version = ($2 == "LD")',
      '$1 == "version" && expect_ld_version',
      "$2 != expected",
      "__LLVM_COV|__llvm_prf_",
    ],
    "MAUI packaged Apple sidecar must reject non-App-Store toolchain provenance",
  );
  expectIncludes(
    "libraries/godot-iap/scripts/verify-ios-toolchain.sh",
    [
      'EXPECTED_SDK_VERSION="${APP_STORE_SDK_VERSION:-26.5}"',
      'EXPECTED_LD_VERSION="${APP_STORE_LD_VERSION:-1267.0}"',
      "xcrun vtool -show-build",
      '$1 == "sdk" {',
      "sdk_failed = 1",
      "exit (sdk_found && !sdk_failed) ? 0 : 1",
      '$1 == "cmd" && $2 == "LC_BUILD_VERSION"',
      'expect_ld_version = ($2 == "LD")',
      '$1 == "version" && expect_ld_version',
      "$2 != expected",
      "__LLVM_COV|__llvm_prf_",
      "Rebuild with Xcode 26.6 / iPhoneOS SDK $EXPECTED_SDK_VERSION before release.",
    ],
    "Godot tracked iOS frameworks must require exact stable toolchain provenance",
  );
  expectIncludes(
    "libraries/godot-iap/Makefile",
    [
      "ios-build:",
      "macos-build:",
      "CLANG_ENABLE_CODE_COVERAGE=NO",
      "ENABLE_CODE_COVERAGE=NO",
      "SWIFT_ENABLE_CODE_COVERAGE=NO",
      'android:value="$(GODOT_VERSION).stable"',
      "describe --tags --exact-match",
      "expected $(SWIFT_GODOT_VERSION)",
    ],
    "Godot release framework builds must disable code-coverage instrumentation",
  );
  for (const godotWorkflow of [
    ".github/workflows/ci-godot-iap.yml",
    ".github/workflows/release-godot.yml",
  ]) {
    expectIncludes(
      godotWorkflow,
      [
        "Verify tracked iOS framework toolchain",
        "bash scripts/verify-ios-toolchain.sh",
        "godot-lib.4.3.stable.template_release.aar",
        "godot-lib.4.7.1.stable.template_release.aar",
      ],
      `${godotWorkflow} must validate tracked iOS framework toolchain provenance`,
    );
  }
  expectIncludes(
    ".github/workflows/ci-godot-iap.yml",
    ["version: 4.7.1", 'xcode-version: "26.6"', "SwiftGodot v0.79.0"],
    "Godot CI must validate the pinned engine and SwiftGodot toolchain",
  );
  expectNotIncludes(
    ".github/workflows/ci-godot-iap.yml",
    ['xcode-version: "26.0"'],
    "Godot CI must not retain stale engine or Swift toolchain pins",
  );
  expectIncludes(
    ".github/workflows/release-godot.yml",
    [
      "Verify selected iOS framework toolchain",
      'bash scripts/verify-ios-toolchain.sh "$VERIFY_DIR/addons/godot-iap/bin/ios"',
    ],
    "Godot releases must validate the selected tag and packaged iOS frameworks",
  );
  for (const eventName of ["pull_request", "push"]) {
    const eventBlock = read(".github/workflows/ci-maui-iap.yml").match(
      new RegExp(
        `${eventName}:([\\s\\S]*?)(?=\\n  (?:pull_request|push|workflow_dispatch|schedule):|\\nconcurrency:)`,
      ),
    )?.[1];
    if (!eventBlock?.includes('"packages/apple/Sources/**"')) {
      fail(
        `.github/workflows/ci-maui-iap.yml ${eventName} paths must cover all Apple sources for Xcode 27 compilation`,
      );
    }
  }
  expectIncludes(
    "scripts/install-xcodegen.sh",
    [
      "XCODEGEN_VERSION",
      "XCODEGEN_SHA256",
      "https://github.com/yonaskolb/XcodeGen/releases/download/${VERSION}/xcodegen.zip",
      "shasum -a 256 -c -",
      "install -m 0755",
      "GITHUB_PATH",
    ],
    "XcodeGen installer must pin release artifacts",
  );
  for (const xcodegenWorkflow of [
    ".github/workflows/ci-maui-iap.yml",
    ".github/workflows/release-maui.yml",
  ]) {
    expectIncludes(
      xcodegenWorkflow,
      [
        "XCODEGEN_VERSION: 2.45.4",
        "XCODEGEN_SHA256: 090ec29491aad50aec10631bf6e62253fed733c50f3aab0f5ffc86bc170bdbef",
        'bash scripts/install-xcodegen.sh "$XCODEGEN_VERSION"',
      ],
      `${xcodegenWorkflow} must pin XcodeGen`,
    );
    expectNotIncludes(
      xcodegenWorkflow,
      ["brew install xcodegen"],
      `${xcodegenWorkflow} must not float XcodeGen via Homebrew`,
    );
  }
  expectIncludes(
    "packages/apple/scripts/build-xcframework.sh",
    ["scripts/install-xcodegen.sh <version>"],
    "Apple xcframework script must point to pinned XcodeGen installer",
  );
  expectIncludes(
    "scripts/bump-version.mjs",
    [
      "const currentVersion = versions[target];",
      "${currentVersion} → ${newVersion}",
      "chore(version): bump <target> to X.X.X",
      "target === 'apple'",
      "updateNativeVersion",
      "`google-${bumpedVersions.google}`",
    ],
    "root bump-version output",
  );
  expectIncludes(
    "knowledge/internal/06-git-deployment.md",
    [
      "Creates Git tag `<apple-version>` (bare semver)",
      "Creates Git tag `google-<google-version>`",
      "gh workflow run release.yml --ref main -f version=current",
      "`docs-{version}`",
      "Run the stable Docs workflow only when the spec",
      "If a Docs GitHub Release is requested while `spec` is unchanged",
      "immutable tag scheme cannot represent it",
      "still equal the workflow dispatch SHA after validation",
      "stop instead of rebasing unverified commits into the release",
      "immutable provenance tag must be pushed atomically before",
      "contains the version while its provenance tag is absent",
      "empty provenance-recovery commit",
      "Git omits up-to-date refs",
    ],
    "release deployment docs tag conventions",
  );
  expectNotIncludes(
    "scripts/deploy.sh",
    ['git commit -m "chore: bump spec'],
    "deploy script commit message must be conventional",
  );
  expectIncludes(
    "scripts/deploy.sh",
    [
      "DOCS_TAG_STATUS=$?",
      '[ "$DOCS_TAG_STATUS" -eq 2 ]',
      "Unable to determine whether $DOCS_TAG exists",
      "Check the remote tag state before creating a Docs GitHub Release",
    ],
    "docs deployment must distinguish a missing tag from remote lookup failures",
  );
  expectNotIncludes(
    ".github/workflows/release.yml",
    ['git commit -m "chore: bump docs'],
    "docs release workflow commit message must be conventional",
  );
  expectNotIncludes(
    "scripts/bump-version.mjs",
    [
      "chore: bump version",
      "${versions[t]} → ${newVersion}",
      "git tag vX.X.X",
      "`docs-${bumpedVersions.spec}`",
      "Bump spec (gql/docs) version",
    ],
    "root bump-version output must be accurate and conventional",
  );
  expectNotIncludes(
    "knowledge/internal/06-git-deployment.md",
    [
      "Creates Git tag `apple-v<apple-version>`",
      "Creates Git tag `google-v<google-version>`",
      "Create Git tag `v<spec>`",
      "or when the maintainer asks for",
    ],
    "release deployment docs must not mention legacy tag creation",
  );
  for (const monorepoContribDoc of [
    "packages/apple/CONTRIBUTING.md",
    "packages/google/CONTRIBUTING.md",
    "libraries/kmp-iap/CONTRIBUTING.md",
  ]) {
    expectNotIncludes(
      monorepoContribDoc,
      [
        "openiap-apple.git",
        "openiap-google.git",
        "github.com/hyodotdev/openiap-apple",
        "github.com/hyodotdev/openiap-google",
        "git commit -m 'Add amazing feature'",
      ],
      "contributing docs must describe the monorepo workflow",
    );
  }
  expectNotIncludes(
    "scripts/sync-versions.mjs",
    ["resolve(rootDir, 'versions.json')", "Read versions.json"],
    "root version sync script must use openiap-versions.json",
  );
  expectIncludes(
    "scripts/bump-version.mjs",
    ["openiap-versions.json"],
    "root version bump script",
  );
  expectNotIncludes(
    "scripts/bump-version.mjs",
    [
      "resolve(rootDir, 'versions.json')",
      "Updated versions.json",
      "packages/ios/Sources/OpenIapVersion.swift",
      "public static let current",
    ],
    "root version bump script must not use obsolete version paths",
  );
  expectNotIncludes(
    "knowledge/internal/04-platform-packages.md",
    ['change `"gql"` version', "update the `gql` field"],
    "platform package docs must use openiap-versions.json spec key",
  );

  for (const dependencyFile of [
    ".github/workflows/release-godot.yml",
    "libraries/flutter_inapp_purchase/android/build.gradle",
    "libraries/godot-iap/addons/godot-iap/godot_iap_plugin.gd",
    "libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap",
    "libraries/godot-iap/Makefile",
    "libraries/godot-iap/scripts/write-gdap.sh",
  ]) {
    expectNotIncludes(
      dependencyFile,
      ["com.android.billingclient:billing"],
      "Framework libraries must inherit Play Billing from openiap-google",
    );
  }

  expectIncludes(
    "libraries/godot-iap/addons/godot-iap/godot_iap_plugin.gd",
    [
      "ANDROID_GDAP_PATH",
      "_read_android_remote_dependencies",
      "FileAccess.get_file_as_string(ANDROID_GDAP_PATH)",
    ],
    "Godot export plugin dependency source",
  );
  expectNotIncludes(
    "libraries/godot-iap/addons/godot-iap/godot_iap_plugin.gd",
    ["openiap-google:", "kotlinx-coroutines-android:"],
    "Godot export plugin must read dependency versions from GDAP",
  );
  expectIncludes(
    "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift",
    [
      "ErrorCode.userCancelled.rawValue",
      "ErrorCode.developerError.rawValue",
      "ErrorCode.syncError.rawValue",
    ],
    "Godot iOS purchase errors must emit OpenIAP error codes",
  );
  expectNotIncludes(
    "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift",
    [
      '"USER_CANCELLED"',
      '"MISSING_SKU"',
      '"PURCHASE_FAILED"',
      '"RESTORE_FAILED"',
    ],
    "Godot iOS purchase errors must not emit legacy custom codes",
  );

  if (googleVersion) {
    expectIncludes(
      "libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap",
      [`io.github.hyochan.openiap:openiap-google:${googleVersion}`],
      "Godot Android GDAP OpenIAP dependency version",
    );
  }
  if (googleCoroutinesVersion) {
    expectIncludes(
      "libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap",
      [
        `org.jetbrains.kotlinx:kotlinx-coroutines-android:${googleCoroutinesVersion}`,
      ],
      "Godot Android GDAP coroutines dependency version",
    );
    expectIncludes(
      "libraries/godot-iap/scripts/write-gdap.sh",
      [
        "set -euo pipefail",
        "GOOGLE_OPENIAP_BUILD=",
        "read_openiap_version()",
        'python3 - "$VERSIONS_FILE" "$1"',
        'OPENIAP_GOOGLE_VERSION="$(read_openiap_version google)"',
        "COROUTINES_VERSION=",
        "read_google_variable coroutinesVersion",
        "fallback_property kotlinxCoroutinesVersion",
        'remote=["io.github.hyochan.openiap:openiap-google:$OPENIAP_GOOGLE_VERSION", "org.jetbrains.kotlinx:kotlinx-coroutines-android:$COROUTINES_VERSION"]',
      ],
      "Godot GDAP dependency writer",
    );
    expectIncludes(
      "libraries/godot-iap/scripts/sync-versions.sh",
      [
        "set -euo pipefail",
        "GOOGLE_OPENIAP_BUILD=",
        "read_openiap_version()",
        'python3 - "$VERSIONS_FILE" "$1"',
        "read_google_variable coroutinesVersion",
        "fallback_property kotlinxCoroutinesVersion",
      ],
      "Godot version sync must read coroutines from packages/google when available",
    );
    expectIncludes(
      "libraries/godot-iap/scripts/build_android.sh",
      ["set -euo pipefail"],
      "Godot Android build script must fail on unset vars and pipeline failures",
    );
    expectIncludes(
      "libraries/godot-iap/Makefile",
      ["scripts/write-gdap.sh"],
      "Godot Makefile must use shared GDAP writer",
    );
    expectIncludes(
      "libraries/godot-iap/Makefile",
      [
        "gh release list --repo hyodotdev/openiap",
        'startswith("godot-iap-")',
        "RELEASE_VERSION = $(patsubst godot-iap-%,%,$(RELEASE_TAG))",
        "https://github.com/hyodotdev/openiap/releases/download/$(RELEASE_TAG)/$(RELEASE_ZIP_NAME)",
      ],
      "Godot Makefile release test target must use monorepo release assets",
    );
    expectNotIncludes(
      "libraries/godot-iap/Makefile",
      [
        "hyochan/godot-iap",
        "github.com/hyochan/godot-iap/releases",
        "RELEASE_ZIP_NAME = godot-iap-$(RELEASE_TAG).zip",
      ],
      "Godot Makefile release test target must not use standalone release assets",
    );
    expectIncludes(
      ".github/workflows/release-godot.yml",
      [
        "./scripts/write-gdap.sh dist/addons/godot-iap/android/GodotIap.gdap",
        "https://openiap.dev/docs/setup/godot",
        "https://openiap.dev/docs/apis",
        "https://openiap.dev/docs/updates/releases",
      ],
      "Godot release workflow must use shared GDAP writer",
    );
    expectNotIncludes(
      ".github/workflows/release-godot.yml",
      ["https://www.openiap.dev"],
      "Godot release workflow docs links must use canonical OpenIAP URLs",
    );
  }
  expectIncludes(
    "libraries/kmp-iap/native/InAppPurchaseBridge/Package.swift",
    [
      "resolveOpenIapAppleVersion()",
      "resolveOpenIapApplePackageVersion",
      "openiap-versions.json",
      "openIapApplePackageVersion",
    ],
    "KMP native bridge OpenIAP Apple dependency version",
  );
  expectNotIncludes(
    "libraries/kmp-iap/native/InAppPurchaseBridge/Package.swift",
    ['from: "1.2.5"', 'return "2.1.9"', "Version(2, 1, 9)"],
    "KMP native bridge OpenIAP Apple dependency version",
  );
  expectIncludes(
    "libraries/kmp-iap/native/InAppPurchaseBridge/Sources/InAppPurchaseBridge/InAppPurchaseBridge.swift",
    ["@_exported import OpenIAP"],
    "KMP native bridge SwiftPM target source",
  );
  expectIncludes(
    "libraries/kmp-iap/library/build.gradle.kts",
    [
      "val kmpRootDir = projectDir.parentFile",
      'kmpRootDir.resolve("gradle.properties")',
      'kmpRootDir.resolve("openiap-versions.json")',
      "missing openiap-versions.json",
      "'$key' version missing in openiap-versions.json",
      'openIapVersion("apple")',
      'openIapVersion("google")',
      'project.findProperty("libraryVersion")',
      "GenerateKmpIapVersionTask",
      "generateKmpIapVersion",
    ],
    "KMP Gradle native dependency versions",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/build.gradle.kts",
    [
      '?: "1.2.5"',
      '?: "1.2.10"',
      "1.0.0-alpha02",
      "1.0.0-alpha04",
      "openiap-versions.json with kmp-iap version",
      "tasks.withType<PublishToMavenRepository>",
      "DEBUG:",
      "First 50 chars",
    ],
    "KMP Gradle native dependency versions must not silently fallback",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt",
    ['override fun getVersion(): String = kmpIapVersionString("Android")'],
    "KMP Android runtime version",
  );
  expectIncludes(
    "libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt",
    ['override fun getVersion(): String = kmpIapVersionString("iOS")'],
    "KMP iOS runtime version",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/Helper.kt",
    ["ANDROID_VERSION", "1.0.0-alpha02"],
    "KMP Android runtime version must not be stale",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt",
    ["1.0.0-rc.2"],
    "KMP iOS runtime version must not be stale",
  );
  expectNotIncludes(
    "libraries/kmp-iap/README.md",
    ["1.0.0-rc.2", "1.0.0-alpha02"],
    "KMP README version examples must not be stale",
  );
  expectIncludes(
    ".github/workflows/release-kmp.yml",
    [
      "Update release metadata",
      "Check if release tag already exists",
      "Checkout release tag (current version)",
      'git checkout "$RELEASE_TAG"',
      "libraryVersion=$ENV{VERSION}",
      './scripts/update-readme-version.sh "$VERSION"',
      "release-branch-policy.mjs guard kmp",
      "RELEASE_BRANCH: ${{ github.ref_name }}",
      "assert-release-head.mjs",
      '"$RELEASE_BRANCH" "$GITHUB_SHA"',
      "published without a provenance tag",
      "git push --atomic origin",
      '"HEAD:$RELEASE_BRANCH"',
      '"refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
      "https://repo1.maven.org/maven2/io/github/hyochan/kmp-iap/$VERSION/",
      "Unable to verify kmp-iap $VERSION on Maven Central",
      "if: steps.check_maven.outputs.exists == 'false'",
      "Create and push tag",
      'git tag -a "$RELEASE_TAG" "$TAG_TARGET" -m "Release $RELEASE_TAG"',
      "./gradlew :library:assembleRelease --no-daemon --stacktrace",
      "files: libraries/kmp-iap/release-artifacts.zip",
      'implementation("io.github.hyochan:kmp-iap:$VERSION")',
      "implementation 'io.github.hyochan:kmp-iap:$VERSION'",
      "central.sonatype.com/artifact/io.github.hyochan/kmp-iap/$VERSION",
    ],
    "KMP release workflow metadata sync",
  );
  expectNotIncludes(
    ".github/workflows/release-kmp.yml",
    ["create_release:", "inputs.create_release"],
    "KMP release workflow must always create GitHub releases",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/setup/kmp.tsx",
    ["https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap"],
    "docs KMP Maven Central link",
  );
  expectIncludes(
    "packages/docs/src/lib/images.ts",
    ["documentationUrl: 'https://openiap.dev/docs/setup/kmp'"],
    "KMP docs card should point at OpenIAP docs",
  );
  expectNotIncludes(
    "packages/docs/src/lib/images.ts",
    ["documentationUrl: 'https://hyochan.github.io/kmp-iap'"],
    "KMP docs card must not point at the legacy standalone docs",
  );
  expectIncludes(
    "scripts/agent/context-files.ts",
    [
      "libraries/flutter_inapp_purchase/pubspec.yaml",
      "libraries/kmp-iap/gradle.properties",
      "libraries/godot-iap/addons/godot-iap/plugin.cfg",
      "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    ],
    "AI context compiler framework package version source manifest",
  );
  expectIncludes(
    "scripts/agent/compile-context.ts",
    [
      "function readInstallationVersions()",
      "CONTEXT_SOURCES.flutterPackage",
      "CONTEXT_SOURCES.kmpPackage",
      "CONTEXT_SOURCES.godotPackage",
      "CONTEXT_SOURCES.mauiPackage",
      "<PackageId>([^<]+)<\\/PackageId>",
      "flutter pub add flutter_inapp_purchase",
      "io.github.hyochan:kmp-iap:${versions.kmp}",
      "godot-iap-${versions.godot}.zip",
      "dotnet add package ${versions.mauiPackageId}",
      "Current NuGet package version: ${versions.maui}",
      "https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap",
    ],
    "AI context compiler framework package versions",
  );
  expectNotIncludes(
    "scripts/agent/compile-context.ts",
    [
      "flutter_inapp_purchase: ^${versions.flutter}",
      "io.github.hyochan:kmp-iap:<version>",
      'OpenIap.Maui" Version="${versions.maui}"',
      "dotnet add package OpenIap.Maui",
    ],
    "AI context compiler install commands must not hardcode framework package versions",
  );
  expectNotIncludes(
    ".github/workflows/release-kmp.yml",
    [
      "updatePodspecDependency",
      "updateReadmeVersion",
      "spec\\.version\\s+=",
      "library/library.podspec gradle.properties",
      "io.github.hyochan.openiap:kmp-iap",
      "central.sonatype.com/artifact/io.github.hyochan.openiap/kmp-iap",
      "git pull --rebase origin main || true",
      'git push || echo "No changes to commit"',
      "git stash --include-untracked || true",
      "cp library/build/outputs/aar/*.aar release-artifacts/ || true",
      "cp library/build/libs/*.jar release-artifacts/ || true",
    ],
    "KMP release workflow must not call removed tasks or publish wrong coordinates",
  );
  expectIncludes(
    ".github/workflows/release-kmp.yml",
    [
      "artifacts=(library/build/outputs/aar/*.aar library/build/libs/*.jar)",
      "No KMP release artifacts found",
      'cp "${artifacts[@]}" release-artifacts/',
    ],
    "KMP release workflow must fail when release artifacts are missing",
  );
  expectIncludes(
    ".github/workflows/release-maui.yml",
    [
      "- name: Create and push tag",
      "if: success()",
      'git tag -a "$RELEASE_TAG" "$TAG_TARGET" -m "Release $RELEASE_TAG"',
      "published without a provenance tag",
      "git push --atomic origin",
      '"HEAD:$RELEASE_BRANCH"',
      '"refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
    ],
    "MAUI release workflow must create tags before GitHub Release creation",
  );
  expectNotIncludes(
    ".github/workflows/release-maui.yml",
    ["create_release:", "inputs.create_release"],
    "MAUI release workflow must always create GitHub releases",
  );
  expectNotIncludes(
    "packages/docs/src/pages/docs/setup/kmp.tsx",
    ["io.github.hyochan.kmpiap/library"],
    "docs KMP Maven Central link must not use old coordinates",
  );
  expectNotIncludes(
    "scripts/agent/compile-context.ts",
    [
      "flutter_inapp_purchase: ^5.0.0",
      "io.github.hyochan.kmpiap:library",
      'implementation("io.github.hyochan:kmp-iap:<version>")',
      'OpenIap.Maui" Version="1.0.1',
    ],
    "AI context compiler framework package versions must not hardcode stale coordinates",
  );
  const kmpReadmeInjectedVersionSnippet =
    'implementation("io.github.hyochan:kmp-iap:' + '$ENV{VERSION}")';
  expectIncludes(
    "libraries/kmp-iap/scripts/update-readme-version.sh",
    [
      'implementation("io.github.hyochan:kmp-iap:<version>")',
      "https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap",
    ],
    "KMP README version script",
  );
  expectNotIncludes(
    "libraries/kmp-iap/scripts/update-readme-version.sh",
    [
      "perl -0pi",
      kmpReadmeInjectedVersionSnippet,
      "sed -i",
      "based on local.properties",
    ],
    "KMP README version script must not inject release-specific versions",
  );
  expectIncludes(
    "libraries/kmp-iap/publish-local.sh",
    ["grep '^libraryVersion=' gradle.properties"],
    "KMP publish-local version lookup",
  );
  expectNotIncludes(
    "libraries/kmp-iap/publish-local.sh",
    ["grep 'version = ' library/build.gradle.kts"],
    "KMP publish-local version lookup must not read removed literal version",
  );
  expectIncludes(
    "libraries/kmp-iap/library/library.podspec",
    [
      "missing openiap-versions.json",
      "'apple' version missing in openiap-versions.json",
    ],
    "KMP podspec OpenIAP Apple dependency version",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/library.podspec",
    ["openiap_apple_version = '1.2.5'", "fallback version"],
    "KMP podspec OpenIAP Apple dependency version",
  );
  expectIncludes(
    "libraries/kmp-iap/example/iosApp/iosApp.xcodeproj/project.pbxproj",
    ["OPENIAP_APPLE_VERSION=", "<string>$OPENIAP_APPLE_VERSION</string>"],
    "KMP iOS example OpenIAP framework plist version",
  );
  expectNotIncludes(
    "libraries/kmp-iap/example/iosApp/iosApp.xcodeproj/project.pbxproj",
    ["<string>1.2.5</string>"],
    "KMP iOS example OpenIAP framework plist version",
  );
  expectIncludes(
    "libraries/maui-iap/android/openiap/build.gradle.kts",
    [
      "missing openiap-versions.json",
      "'google' version missing in openiap-versions.json",
    ],
    "MAUI Android OpenIAP Google dependency version",
  );
  expectNotIncludes(
    "libraries/maui-iap/android/openiap/build.gradle.kts",
    ['?: "', "?: '"],
    "MAUI Android OpenIAP Google dependency version must not silently fallback",
  );
  expectIncludes(
    "packages/google/build.gradle.kts",
    [
      "missing openiap-versions.json",
      "'google' version missing in openiap-versions.json",
      'id("com.android.library") version "8.13.2"',
      'id("com.android.application") version "8.13.2"',
      'id("com.vanniktech.maven.publish") version "0.37.0"',
    ],
    "packages/google root OpenIAP version",
  );
  expectIncludes(
    "packages/google/gradle/wrapper/gradle-wrapper.properties",
    ["gradle-9.3.0-all.zip"],
    "packages/google Gradle wrapper must support Vanniktech 0.37.0",
  );
  expectNotIncludes(
    "packages/google/build.gradle.kts",
    [
      "GQL_VERSION",
      '"gql"',
      "Fallback",
      'id("com.vanniktech.maven.publish") version "0.29.0"',
      'id("com.vanniktech.maven.publish") version "0.34.0"',
      'id("com.vanniktech.maven.publish") version "0.36.0"',
    ],
    "packages/google root OpenIAP version",
  );
  expectIncludes(
    "packages/google/openiap/build.gradle.kts",
    [
      "missing openiap-versions.json",
      "'google' version missing in openiap-versions.json",
      "compilerOptions",
      "JvmTarget.JVM_17",
      "KotlinAndroidProjectExtension",
      "ANDROID_GRADLE_PLUGIN_VERSION.substringBefore('.')",
      'providers.gradleProperty("android.builtInKotlin")',
      "if (!usesBuiltInKotlin)",
      'pluginManager.apply("org.jetbrains.kotlin.android")',
      "val horizonBillingCompatibilityVersion =",
      "val horizonPlatformKotlinVersion =",
      'val horizonSerializationVersion = "1.9.0"',
      "Expo SDK 57's Kotlin",
      "publishToMavenCentral()",
    ],
    "packages/google module OpenIAP version and Kotlin compiler settings",
  );
  expectNotIncludes(
    "packages/google/openiap/build.gradle.kts",
    [
      '?: "1.0.0"',
      "kotlinOptions",
      'jvmTarget = "17"',
      "SonatypeHost.CENTRAL_PORTAL",
    ],
    "packages/google module OpenIAP version and Kotlin compiler settings",
  );

  const googleBillingVersions = uniqueMatches(
    googleBuildGradle,
    /val\s+playBillingVersion\s*=\s*"([^"]+)"/g,
  );
  if (googleBillingVersions.length !== 1) {
    fail(
      `packages/google must use one Play Billing version, found: ${
        googleBillingVersions.join(", ") || "(none)"
      }`,
    );
  }
  const googleGsonVersions = uniqueMatches(
    googleBuildGradle,
    /com\.google\.code\.gson:gson:([0-9.]+)/g,
  );
  if (googleGsonVersions.length !== 1) {
    fail(
      `packages/google must use one Gson version, found: ${
        googleGsonVersions.join(", ") || "(none)"
      }`,
    );
  }
  expectIncludes(
    "packages/google/openiap/build.gradle.kts",
    [
      "com.android.billingclient:billing:$playBillingVersion",
      "androidx.lifecycle:lifecycle-runtime:2.10.0",
      "androidx.lifecycle:lifecycle-viewmodel:2.10.0",
    ],
    "packages/google Play Billing dependency version",
  );
  expectNotIncludes(
    "packages/google/openiap/build.gradle.kts",
    [
      "androidx.lifecycle:lifecycle-runtime:2.11.0",
      "androidx.lifecycle:lifecycle-viewmodel:2.11.0",
    ],
    "packages/google must not exceed the API 36 compatible Lifecycle line",
  );
  expectNotIncludes(
    "packages/google/openiap/build.gradle.kts",
    ["com.android.billingclient:billing-ktx:"],
    "packages/google must not leak billing-ktx Kotlin metadata to consumers",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/build.gradle.kts",
    ["com.android.billingclient:billing-ktx:"],
    "KMP Android compile classpaths must use the Billing core artifact",
  );
  expectIncludes(
    "libraries/kmp-iap/library/build.gradle.kts",
    ["org.robolectric:robolectric:4.16.1"],
    "KMP Android unit-test runtime version",
  );
  expectNotIncludes(
    "libraries/kmp-iap/library/build.gradle.kts",
    ["org.robolectric:robolectric:4.13"],
    "KMP Android unit-test runtime must not retain the old Robolectric pin",
  );
  expectNotIncludes(
    "packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt",
    ["printStackTrace()"],
    "Google production Store code must use structured logging",
  );
  expectNotIncludes(
    "packages/google/openiap/src/play/java/dev/hyo/openiap/OpenIapModule.kt",
    [
      "printStackTrace()",
      `${TODO_MARKER}: In production`,
      "alternativeBillingCallback?.onTokenCreated",
    ],
    "Google Play production module must use structured logging",
  );
  expectNotIncludes(
    "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
    [
      "requestIds.forEach(::add)",
      "abortedRequestIds.forEach",
      "receipts.forEach",
    ],
    "Amazon Java collection iteration must remain compatible with API 23",
  );
  expectNotIncludes(
    "packages/google/openiap/src/horizon/java/dev/hyo/openiap/OpenIapModule.kt",
    ["details.forEach"],
    "Horizon Java collection iteration must remain compatible with API 23",
  );
  expectNotIncludes(
    "packages/google/openiap/src/horizon/java/dev/hyo/openiap/helpers/ProductManager.kt",
    ["details.forEach", "requestedProductIds.forEach", "list.forEach"],
    "Horizon product collection iteration must remain compatible with API 23",
  );
  const googleBuildRoot = read("packages/google/build.gradle.kts");
  const googleCompileSdk = googleBuildGradle.match(
    /compileSdk\s*=\s*(\d+)/,
  )?.[1];
  const googleMinSdk = googleBuildGradle.match(/minSdk\s*=\s*(\d+)/)?.[1];
  const googleAndroidGradlePluginVersion = googleBuildRoot.match(
    /com\.android\.library"\) version "([^"]+)"/,
  )?.[1];
  const googleKotlinVersion = googleBuildRoot.match(
    /org\.jetbrains\.kotlin\.android"\) version "([^"]+)"/,
  )?.[1];
  const googleKotlinConsumerBuild = read(
    "packages/google/compatibility/kotlin-2.1-consumer/build.gradle.kts",
  );
  const googleKotlinConsumerVersion = googleKotlinConsumerBuild.match(
    /org\.jetbrains\.kotlin\.android"\) version "([^"]+)"/,
  )?.[1];
  if (!googleCompileSdk)
    fail("packages/google openiap build.gradle.kts must declare compileSdk");
  if (!googleMinSdk)
    fail("packages/google openiap build.gradle.kts must declare minSdk");
  if (!googleAndroidGradlePluginVersion)
    fail(
      "packages/google build.gradle.kts must declare Android Gradle plugin version",
    );
  if (!googleKotlinVersion)
    fail(
      "packages/google build.gradle.kts must declare Kotlin Android plugin version",
    );
  if (!googleKotlinConsumerVersion)
    fail("packages/google Kotlin consumer fixture must pin a compiler version");
  if (googleKotlinConsumerVersion !== "2.1.20")
    fail("packages/google Kotlin consumer baseline must remain 2.1.20");
  if (
    googleCompileSdk &&
    googleMinSdk &&
    googleBillingVersions.length === 1 &&
    googleKotlinVersion &&
    googleKotlinConsumerVersion
  ) {
    expectIncludes(
      "packages/google/README.md",
      [
        `API-${googleMinSdk}%2B`,
        `api?level=${googleMinSdk}`,
        `**Minimum SDK**: ${googleMinSdk}`,
        `**Compile SDK**: ${googleCompileSdk}`,
        `**Google Play Billing**: v${googleBillingVersions[0]}`,
        `**Kotlin compiler (consumer)**: ${googleKotlinConsumerVersion}+`,
      ],
      "Google README requirements",
    );
    expectIncludes(
      "packages/google/Example/build.gradle.kts",
      [
        "openIapBuildFile",
        'readOpenIapAndroidInt("compileSdk")',
        'readOpenIapAndroidInt("minSdk")',
        'readOpenIapDependencyVersion("androidx.core:core")',
        'readOpenIapDependencyVersion("androidx.lifecycle:lifecycle-runtime")',
        'readOpenIapDependencyVersion("androidx.lifecycle:lifecycle-viewmodel")',
        'readOpenIapDependencyVersion("junit:junit")',
        "compileSdk = openIapCompileSdk",
        "minSdk = openIapMinSdk",
        "targetSdk = openIapTargetSdk",
        'implementation("androidx.core:core:$openIapCoreVersion")',
        'implementation("androidx.lifecycle:lifecycle-runtime:$openIapLifecycleRuntimeVersion")',
        'implementation("androidx.lifecycle:lifecycle-viewmodel-compose:$openIapLifecycleViewModelVersion")',
        'implementation("androidx.compose.material:material-icons-extended:$composeMaterialIconsVersion")',
        "COMPOSE_MATERIAL_ICONS_VERSION",
        'testImplementation("junit:junit:$openIapJunitVersion")',
      ],
      "Google example overlapping Android versions must derive from openiap module",
    );
    expectNotIncludes(
      "packages/google/Example/build.gradle.kts",
      [
        "compileSdk = 35",
        "minSdk = 24",
        "targetSdk = 35",
        "androidx.core:core-ktx:",
        "androidx.lifecycle:lifecycle-runtime-ktx:",
        "androidx.lifecycle:lifecycle-viewmodel-ktx:",
        "androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7",
        "junit:junit:4.13.2",
      ],
      "Google example overlapping Android versions must not drift from openiap module",
    );
    expectIncludes(
      "libraries/expo-iap/android/build.gradle",
      [
        "openiap-android-sdk.gradle",
        "resolvePackageJsonFile()",
        "expoIapPackageVersion",
        "version = expoIapPackageVersion",
        "versionName = expoIapPackageVersion",
        `openIapResolveAndroidSdkVersion('compileSdkVersion', 'compileSdk', ${googleCompileSdk})`,
        `openIapResolveAndroidSdkVersion('minSdkVersion', 'minSdk', ${googleMinSdk})`,
        `openIapResolveAndroidSdkVersion('targetSdkVersion', 'compileSdk', ${googleCompileSdk})`,
        "compileSdk = openIapCompileSdkVersion",
        "minSdk = openIapMinSdkVersion",
        "targetSdk = openIapTargetSdkVersion",
      ],
      "Expo Android SDK versions must follow openiap-google",
    );
    expectIncludes(
      "libraries/expo-iap/android/openiap-android-sdk.gradle",
      [
        "packages/google/openiap/build.gradle.kts",
        "openIapResolveAndroidSdkVersion",
        "rootProject.ext.has(extName)",
      ],
      "Expo Android SDK versions must derive from openiap-google when available",
    );
    expectNotIncludes(
      "libraries/expo-iap/android/build.gradle",
      [
        'safeExtGet("compileSdkVersion", 34)',
        'safeExtGet("targetSdkVersion", 34)',
        "compileSdkVersion openIapCompileSdkVersion",
        "minSdkVersion openIapMinSdkVersion",
        "targetSdkVersion openIapTargetSdkVersion",
        'namespace "expo.modules.iap"',
        "abortOnError false",
        "versionCode 1",
        'versionName "0.1.0"',
        "version = '0.1.0'",
        'versionName = "0.1.0"',
      ],
      "Expo Android SDK fallbacks must not lag openiap-google",
    );
    expectOptionalNotIncludes(
      "libraries/expo-iap/example/android/build.gradle",
      ["url 'https://www.jitpack.io'"],
      "Expo example root Gradle must avoid deprecated Groovy property syntax",
    );
    expectOptionalIncludes(
      "libraries/expo-iap/example/android/app/build.gradle",
      [
        "compileSdk = rootProject.ext.compileSdkVersion",
        "minSdk = rootProject.ext.minSdkVersion",
        "targetSdk = rootProject.ext.targetSdkVersion",
        "namespace 'dev.hyo.martie'",
        "applicationId 'dev.hyo.martie'",
      ],
      "Expo example app Gradle must preserve Expo-compatible app identity syntax",
    );
    expectOptionalNotIncludes(
      "libraries/expo-iap/example/android/app/build.gradle",
      [
        "ndkVersion rootProject.ext.ndkVersion",
        "buildToolsVersion rootProject.ext.buildToolsVersion",
        "compileSdk rootProject.ext.compileSdkVersion",
        "namespace = 'dev.hyo.martie'",
        "applicationId = 'dev.hyo.martie'",
        "minSdkVersion rootProject.ext.minSdkVersion",
        "targetSdkVersion rootProject.ext.targetSdkVersion",
        "signingConfig signingConfigs.debug",
        "shrinkResources enableShrinkResources.toBoolean()",
        "crunchPngs enablePngCrunchInRelease.toBoolean()",
        "useLegacyPackaging enableLegacyPackaging.toBoolean()",
        "ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'",
      ],
      "Expo example app Gradle must use normalized syntax without breaking Expo app-id resolution",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/android/build.gradle",
      [
        "locateGoogleRootBuildFile",
        "readPubspecVersion",
        "flutterPackageVersion",
        "version = flutterPackageVersion",
        "googlePluginVersion('com.android.library')",
        "openIapAndroidGradlePluginVersion",
        "openIapKotlinVersion",
        "readRequiredAndroidGradleProperty",
        "readRequiredAndroidGradleProperty(projectDir, 'openIapAndroidAnnotationVersion')",
        'classpath "com.android.tools.build:gradle:$androidGradlePluginVersion"',
        "openiap-android-sdk.gradle",
        "ANDROID_GRADLE_PLUGIN_VERSION.tokenize('.')",
        "findProperty('android.builtInKotlin')",
        "if (!usesBuiltInKotlin)",
        `openIapResolveAndroidSdkVersion('compileSdkVersion', 'compileSdk', ${googleCompileSdk})`,
        `openIapResolveAndroidSdkVersion('minSdkVersion', 'minSdk', ${googleMinSdk})`,
        `openIapResolveAndroidSdkVersion('targetSdkVersion', 'compileSdk', ${googleCompileSdk})`,
        "compileSdk = openIapCompileSdkVersion",
        "minSdkVersion = openIapMinSdkVersion",
        "targetSdkVersion = openIapTargetSdkVersion",
      ],
      "Flutter Android minSdk must follow openiap-google",
    );
    expectNotIncludes(
      "libraries/flutter_inapp_purchase/android/build.gradle",
      [
        "namespace 'io.github.hyochan.flutter_inapp_purchase'",
        "compileSdkVersion openIapCompileSdkVersion",
        "minSdkVersion openIapMinSdkVersion",
        "targetSdkVersion openIapTargetSdkVersion",
        "com.android.tools.build:gradle:8.7.3",
        "implementation 'androidx.annotation:annotation:1.6.0'",
        "implementation files('jars/in-app-purchasing-2.0.76.jar')",
        "openIapAmazonIapJarFile",
        "version = '1.0-SNAPSHOT'",
      ],
      "Flutter Android Gradle must avoid deprecated Groovy property syntax",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/example/android/app/build.gradle",
      [
        "openiap-android-sdk.gradle",
        "ANDROID_GRADLE_PLUGIN_VERSION.tokenize('.')",
        "findProperty('android.builtInKotlin')",
        "if (!usesBuiltInKotlin)",
        "compileSdk = openIapCompileSdkVersion",
        "minSdkVersion = openIapMinSdkVersion",
        "targetSdkVersion = openIapTargetSdkVersion",
        "openIapResolveDependencyVersion('junit:junit', 'openIapJunitVersion')",
        "openIapResolveDependencyVersion('androidx.test:runner', 'openIapAndroidTestRunnerVersion')",
        "openIapResolveDependencyVersion('androidx.test.espresso:espresso-core', 'openIapEspressoCoreVersion')",
        'testImplementation "junit:junit:$openIapJunitVersion"',
        'androidTestImplementation "androidx.test:runner:$openIapAndroidTestRunnerVersion"',
        'androidTestImplementation "androidx.test.espresso:espresso-core:$openIapEspressoCoreVersion"',
        "source = '../..'",
      ],
      "Flutter example Android minSdk must follow openiap-google",
    );
    expectNotIncludes(
      "libraries/flutter_inapp_purchase/example/android/app/build.gradle",
      [
        "namespace 'dev.hyo.martie'",
        "compileSdkVersion openIapCompileSdkVersion",
        'ndkVersion "27.0.12077973"',
        'applicationId "dev.hyo.martie"',
        "minSdkVersion openIapMinSdkVersion",
        "targetSdkVersion openIapTargetSdkVersion",
        "testImplementation 'junit:junit:4.13.2'",
        "androidTestImplementation 'androidx.test:runner:1.5.2'",
        "androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'",
        "signingConfig signingConfigs.debug",
        "source '../..'",
      ],
      "Flutter example Android Gradle must avoid deprecated Groovy property syntax",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/example/android/build.gradle",
      [
        "locateGoogleRootBuildFile",
        "googlePluginVersion('com.android.application')",
        "openIapAndroidGradlePluginVersion",
        'classpath "com.android.tools.build:gradle:$androidGradlePluginVersion"',
      ],
      "Flutter example root Gradle plugin version must derive from packages/google",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/example/android/settings.gradle",
      [
        "resolutionStrategy",
        "useVersion(androidGradlePluginVersion)",
        "useVersion(kotlinPluginVersion)",
        'id "com.android.application" apply false',
        'id "org.jetbrains.kotlin.android" apply false',
      ],
      "Flutter example Android Gradle plugin version must derive from packages/google",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/android/gradle.properties",
      [
        `openIapAndroidGradlePluginVersion=${googleAndroidGradlePluginVersion}`,
        "openIapKotlinVersion=2.4.10",
        "openIapAndroidAnnotationVersion=1.10.0",
        "openIapJunitVersion=",
      ],
      "Flutter Android fallback versions",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/example/android/gradle.properties",
      [
        `openIapAndroidGradlePluginVersion=${googleAndroidGradlePluginVersion}`,
        "openIapKotlinVersion=2.4.10",
        "openIapJunitVersion=",
        "openIapAndroidTestRunnerVersion=",
        "openIapEspressoCoreVersion=",
      ],
      "Flutter example Android fallback versions",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/android/gradle/wrapper/gradle-wrapper.properties",
      ["gradle-9.3.0-bin.zip"],
      "Flutter standalone Android Gradle wrapper must support packages/google AGP",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/example/android/gradle/wrapper/gradle-wrapper.properties",
      ["gradle-9.3.0-all.zip"],
      "Flutter example Android Gradle wrapper must support packages/google AGP",
    );
    expectIncludes(
      "libraries/godot-iap/android/settings.gradle.kts",
      [
        "googlePluginVersion(",
        "googleRootBuildFile",
        "configuredVersion(fallbackPropertyName)",
      ],
      "Godot Android Gradle plugin versions must derive from packages/google when available",
    );
    expectIncludes(
      "libraries/godot-iap/android/gradle.properties",
      [
        `androidGradlePluginVersion=${googleAndroidGradlePluginVersion}`,
        "kotlinVersion=2.4.10",
      ],
      "Godot Android fallback versions",
    );
    expectIncludes(
      "libraries/godot-iap/android/gradle/wrapper/gradle-wrapper.properties",
      ["gradle-9.3.0-bin.zip"],
      "Godot Android Gradle wrapper must support packages/google AGP",
    );
    expectIncludes(
      "libraries/godot-iap/android/build.gradle.kts",
      [
        "googleOpenIapBuildFile",
        'readGoogleAndroidInt("compileSdk", "compileSdkVersion")',
        'readGoogleAndroidInt("minSdk", "minSdkVersion")',
        'readGoogleVariable("coroutinesVersion", "kotlinxCoroutinesVersion")',
        "compileSdk = googleCompileSdk",
        "minSdk = googleMinSdk",
        'implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$googleCoroutinesVersion")',
      ],
      "Godot Android SDK versions must derive from packages/google when available",
    );
    expectNotIncludes(
      "libraries/godot-iap/android/build.gradle.kts",
      [
        "compileSdk = 35",
        "minSdk = 24",
        "val kotlinxCoroutinesVersion: String by project",
        "kotlinx-coroutines-android:$kotlinxCoroutinesVersion",
      ],
      "Godot Android SDK versions must not drift from packages/google",
    );
    expectNotIncludes(
      "libraries/godot-iap/android/settings.gradle.kts",
      [
        'id("com.android.library") version "8.7.2"',
        'id("org.jetbrains.kotlin.android") version "2.2.0"',
      ],
      "Godot Android Gradle plugin versions must not drift from packages/google",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/android/openiap-android-sdk.gradle",
      [
        "openIapFindGoogleOpenIapBuildFile",
        "packages/google/openiap/build.gradle.kts",
        "openIapResolveAndroidSdkVersion",
        "openIapResolveDependencyVersion",
        "openIapReadGoogleDependencyVersion",
        "rootProject.ext.has(extName)",
      ],
      "Flutter Android SDK versions must derive from openiap-google when available",
    );
    expectNotIncludes(
      "libraries/flutter_inapp_purchase/example/android/app/src/main/AndroidManifest.xml",
      ['package="dev.hyo.martie"'],
      "Flutter example Android namespace must live in Gradle",
    );
    expectNotIncludes(
      "libraries/flutter_inapp_purchase/android/build.gradle",
      ["com.android.tools.build:gradle:8.1.4"],
      "Flutter standalone Android Gradle plugin must not lag compileSdk support",
    );
    expectIncludes(
      "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
      ["val payload = JSONObject(serializeOpenIapError(e))"],
      "Flutter Android plugin error serialization",
    );
    expectNotIncludes(
      "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
      [
        '@Deprecated("Deprecated channel endpoint; will be removed in 7.0.0")',
        "will be removed in 7.0.0",
        "removed in 7.0.0",
        "when (e)",
      ],
      "Flutter Android plugin must not reintroduce avoidable Kotlin warnings",
    );
    expectNotIncludes(
      "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/FlutterInappPurchasePlugin.kt",
      ["AmazonInappPurchasePlugin", "com.amazon.venezia", "isAppInstalledFrom"],
      "Flutter Android plugin must not expose standalone Amazon support",
    );
    expectIncludes(
      "libraries/react-native-iap/android/gradle.properties",
      [`NitroIap_minSdkVersion=${googleMinSdk}`],
      "React Native Android minSdk must follow openiap-google",
    );
    expectIncludes(
      "packages/docs/src/lib/versioning.ts",
      [
        "googleCompileSdk",
        "googleMinSdk",
        "googlePlayBillingVersion",
        "export const ANDROID_SDK",
        "export const GOOGLE_PLAY_BILLING",
      ],
      "docs Android SDK metadata must derive from generated docs metadata",
    );
    expectIncludes(
      "packages/docs/src/pages/docs/setup/expo.tsx",
      [
        "ANDROID_SDK",
        "GOOGLE_PLAY_BILLING",
        "GOOGLE_PLAY_BILLING.version",
        "minSdkVersion {ANDROID_SDK.minSdk}+",
        "compileSdkVersion {ANDROID_SDK.compileSdk}+",
      ],
      "Expo setup Android requirements",
    );
    expectIncludes(
      "packages/docs/src/pages/docs/setup/flutter.tsx",
      [
        "ANDROID_SDK",
        "minSdkVersion ${ANDROID_SDK.minSdk}",
        "minSdk = ${ANDROID_SDK.minSdk}",
        "compileSdkVersion ${ANDROID_SDK.compileSdk}",
        "compileSdk = ${ANDROID_SDK.compileSdk}",
        "targetSdkVersion ${ANDROID_SDK.targetSdk}",
        "targetSdk = ${ANDROID_SDK.targetSdk}",
      ],
      "Flutter setup Android requirements",
    );
    expectIncludes(
      "packages/docs/src/pages/docs/setup/react-native.tsx",
      [
        "ANDROID_SDK",
        "GOOGLE_PLAY_BILLING",
        "GOOGLE_PLAY_BILLING.version",
        "minSdkVersion {ANDROID_SDK.minSdk}+",
        "compileSdkVersion {ANDROID_SDK.compileSdk}+",
      ],
      "React Native setup Android requirements",
    );
    expectIncludes(
      "packages/docs/src/pages/docs/setup/store/horizon.tsx",
      ["OPENIAP_VERSIONS", "OPENIAP_VERSIONS.google"],
      "Horizon setup docs must use current openiap-google version metadata",
    );
    expectNotIncludes(
      "packages/docs/src/pages/docs/setup/store/horizon.tsx",
      ["openiap-google@1.3.2"],
      "Horizon setup docs must not hardcode stale openiap-google versions",
    );
    expectNotIncludes(
      "packages/docs/src/pages/docs/setup/react-native.tsx",
      ["Google Play Billing 8.0+", "compileSdkVersion 34+"],
      "React Native setup Android requirements must not use stale Google requirements",
    );
    for (const docsSetupFile of [
      "packages/docs/src/pages/docs/setup/expo.tsx",
      "packages/docs/src/pages/docs/setup/flutter.tsx",
      "packages/docs/src/pages/docs/setup/react-native.tsx",
    ]) {
      expectNotIncludes(
        docsSetupFile,
        [
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
        ],
        `${docsSetupFile} Android SDK values must derive from versioning.ts`,
      );
    }
    expectIncludes(
      "libraries/expo-iap/plugin/src/withLocalOpenIAP.ts",
      [
        "resolveAndroidGradlePluginVersions(androidModulePath)",
        "relativeAndroidModulePath",
        "new File(settingsDir, '${relativeAndroidModulePath}')",
        "projectDirPattern",
        "injectPluginManagement();",
        "readGradlePluginVersion(contents,",
        "setGradlePluginVersion(",
        "vanniktechMavenPublish: '0.37.0'",
        "pluginVersions.vanniktechMavenPublish",
        "pluginVersions.kotlin",
      ],
      "Expo local OpenIAP plugin Gradle plugin versions",
    );
    expectOptionalIncludes(
      "libraries/expo-iap/plugin/build/withLocalOpenIAP.js",
      [
        "relativeAndroidModulePath",
        "new File(settingsDir, '${relativeAndroidModulePath}')",
        "projectDirPattern",
        "injectPluginManagement();",
      ],
      "Expo local OpenIAP plugin build output",
    );
    expectNotIncludes(
      "libraries/expo-iap/plugin/src/withLocalOpenIAP.ts",
      ['version "0.29.0"', "new File('${androidModulePath"],
      "Expo local OpenIAP plugin Gradle plugin versions must not drift from packages/google",
    );
    for (const vegaDependencyFile of [
      "libraries/expo-iap/plugin/src/withVega.ts",
      "libraries/expo-iap/example/scripts/build-vega-example.mjs",
      "libraries/react-native-iap/example/scripts/build-vega-example.mjs",
    ]) {
      expectIncludes(
        vegaDependencyFile,
        ["~2.13.0"],
        "Vega examples must install the current Amazon IAP peer",
      );
      expectNotIncludes(
        vegaDependencyFile,
        ["~2.12.13"],
        "Vega examples must not recreate the old Amazon IAP dependency",
      );
    }
    expectIncludes(
      "libraries/expo-iap/plugin/src/withVega.ts",
      ["^0.0.7"],
      "Expo Vega plugin must install the current compatibility Metro config",
    );
    expectOptionalIncludes(
      "libraries/expo-iap/example/android/settings.gradle",
      [
        'id("com.vanniktech.maven.publish") version "0.37.0"',
        'id("org.jetbrains.kotlin.android") version "2.1.20"',
        'id("org.jetbrains.kotlin.plugin.compose") version "2.1.20"',
        "project(':openiap-google').projectDir = new File(settingsDir, '../../../../packages/google/openiap')",
      ],
      "Expo example local OpenIAP plugin versions",
    );
    expectOptionalNotIncludes(
      "libraries/expo-iap/example/android/settings.gradle",
      ['version "0.29.0"', 'version "2.0.21"'],
      "Expo example local OpenIAP plugin versions must not drift",
    );
    expectIncludes(
      "libraries/kmp-iap/gradle/libs.versions.toml",
      ['vanniktech-publish = "0.37.0"'],
      "KMP Vanniktech publish plugin version",
    );
    expectIncludes(
      "libraries/kmp-iap/example/gradle/libs.versions.toml",
      ['vanniktech-publish = "0.37.0"'],
      "KMP example Vanniktech publish plugin version",
    );
    expectIncludes(
      "libraries/kmp-iap/library/build.gradle.kts",
      ["publishToMavenCentral()"],
      "KMP Vanniktech publish target",
    );
    expectIncludes(
      "libraries/kmp-iap/library/build.gradle.kts",
      [
        'url.set("https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap")',
        'name.set("Apache License 2.0")',
        'url.set("https://www.apache.org/licenses/LICENSE-2.0")',
        'organization.set("hyodotdev")',
        'organizationUrl.set("https://github.com/hyodotdev")',
        'connection.set("scm:git:https://github.com/hyodotdev/openiap.git")',
        'developerConnection.set("scm:git:ssh://git@github.com/hyodotdev/openiap.git")',
        'tag.set("kmp-iap-$kmpIapLibraryVersion")',
        'url.set("https://github.com/hyodotdev/openiap/issues")',
      ],
      "KMP Maven metadata must point at the monorepo and local license",
    );
    expectNotIncludes(
      "libraries/kmp-iap/library/build.gradle.kts",
      [
        "github.com/hyochan/kmp-iap",
        'name.set("MIT License")',
        "https://opensource.org/licenses/MIT",
        'tag.set("v$kmpIapLibraryVersion")',
      ],
      "KMP Maven metadata must not point at the legacy standalone repository",
    );
    expectIncludes(
      "libraries/kmp-iap/library/build.gradle.kts",
      [
        "fun dynamicKmpPodspec(): String",
        'tasks.matching { it.name == "podspec" }.configureEach',
        "dynamicKmpPodspec()",
      ],
      "KMP CocoaPods generated podspec must be post-processed by Gradle",
    );
    expectIncludes(
      "libraries/kmp-iap/library/library.podspec",
      [
        "gradle_properties_file",
        "libraryVersion=",
        "spec.version                  = library_version",
        "kmp-iap-#{library_version}",
      ],
      "KMP CocoaPods spec version must follow gradle.properties",
    );
    expectNotIncludes(
      "libraries/kmp-iap/library/library.podspec",
      [
        "spec.version                  = '2.2.8'",
        "spec.source                   = { :http=> ''}",
        "spec.authors                  = ''",
        "spec.license                  = ''",
      ],
      "KMP CocoaPods spec version must not drift from gradle.properties",
    );
    expectIncludes(
      "libraries/kmp-iap/publish-local.sh",
      [
        "set -euo pipefail",
        "read_prop()",
        "ORG_GRADLE_PROJECT_signingInMemoryKey",
        "ORG_GRADLE_PROJECT_signingInMemoryKeyFile",
        ":library:publishAndReleaseToMavenCentral",
      ],
      "KMP local Maven Central publish script",
    );
    expectNotIncludes(
      "libraries/kmp-iap/publish-local.sh",
      ["source local.properties", ". local.properties"],
      "KMP local Maven Central publish script must not source local.properties",
    );
    expectIncludes(
      "libraries/kmp-iap/scripts/publish-local.sh",
      ["set -euo pipefail", '-PlibraryVersion="$VERSION"'],
      "KMP Maven Local publish script",
    );
    expectIncludes(
      "libraries/kmp-iap/scripts/build-all.sh",
      ["set -euo pipefail"],
      "KMP build-all script must fail on unset vars and pipeline failures",
    );
    expectNotIncludes(
      "libraries/kmp-iap/scripts/publish-local.sh",
      ['echo "libraryVersion=$VERSION" > local.properties'],
      "KMP Maven Local publish script must not overwrite local.properties",
    );
    expectIncludes(
      "libraries/kmp-iap/local.properties.template",
      [
        "mavenCentralUsername=your-central-portal-username",
        "mavenCentralPassword=your-central-portal-password",
        "signingInMemoryKeyId=",
        "signingInMemoryKeyPassword=",
        "signingInMemoryKeyFile=",
      ],
      "KMP local.properties template",
    );
    expectIncludes(
      "libraries/kmp-iap/gradle.properties.template",
      [
        "mavenCentralUsername=your-central-portal-username",
        "mavenCentralPassword=your-central-portal-password",
        "signingInMemoryKeyId=",
        "signingInMemoryKeyPassword=",
        "signingInMemoryKeyFile=",
      ],
      "KMP gradle.properties template",
    );
    for (const staleKmpSigningFile of [
      "libraries/kmp-iap/local.properties.template",
      "libraries/kmp-iap/gradle.properties.template",
      "libraries/kmp-iap/gradle.properties",
    ]) {
      expectNotIncludes(
        staleKmpSigningFile,
        [
          "signing.keyId",
          "signing.password",
          "signing.secretKeyRingFile",
          "signing.gnupg.keyName",
          "signing.gnupg.passphrase",
          "your-sonatype-username",
          "your-sonatype-password",
        ],
        `${staleKmpSigningFile} must use current Vanniktech signing properties`,
      );
    }
    expectIncludes(
      "packages/google/scripts/publish-local.sh",
      [":openiap:publishAndReleaseToMavenCentral"],
      "Google local publish Central Portal task",
    );
    expectNotIncludes(
      "libraries/kmp-iap/gradle/libs.versions.toml",
      [
        'vanniktech-publish = "0.29.0"',
        'vanniktech-publish = "0.34.0"',
        'vanniktech-publish = "0.36.0"',
      ],
      "KMP Vanniktech publish plugin version must not use deprecated plugin",
    );
    expectNotIncludes(
      "libraries/kmp-iap/example/gradle/libs.versions.toml",
      [
        'vanniktech-publish = "0.29.0"',
        'vanniktech-publish = "0.34.0"',
        'vanniktech-publish = "0.36.0"',
      ],
      "KMP example Vanniktech publish plugin version must not use deprecated plugin",
    );
    expectNotIncludes(
      "libraries/kmp-iap/library/build.gradle.kts",
      [
        "SonatypeHost.CENTRAL_PORTAL",
        '"sonatypeRepositoryId"',
        '"sonatypeAutomaticRelease"',
      ],
      "KMP Vanniktech publish target must use Central Portal default API",
    );
    for (const publishingFile of [
      "libraries/kmp-iap/gradle.properties",
      "libraries/kmp-iap/publish-local.sh",
      "packages/google/scripts/publish-local.sh",
    ]) {
      expectNotIncludes(
        publishingFile,
        [
          "SONATYPE_HOST",
          "sonatypeHost",
          "sonatypeRepositoryId",
          "sonatypeAutomaticRelease",
          "SONATYPE_AUTOMATIC_RELEASE",
          "mavenCentralStagingProfileId",
          "sonatypeStagingProfileId",
          "ORG_GRADLE_PROJECT_mavenCentralPublishing",
          "ORG_GRADLE_PROJECT_signAllPublications",
        ],
        `${publishingFile} must not use legacy Sonatype host properties`,
      );
    }
  }

  const horizonBillingVersions = uniqueMatches(
    googleBuildGradle,
    /val\s+horizonBillingCompatibilityVersion\s*=\s*"([^"]+)"/g,
  );
  const horizonPlatformKotlinVersions = uniqueMatches(
    googleBuildGradle,
    /val\s+horizonPlatformKotlinVersion\s*=\s*"([^"]+)"/g,
  );
  const horizonSerializationVersions = uniqueMatches(
    googleBuildGradle,
    /val\s+horizonSerializationVersion\s*=\s*"([^"]+)"/g,
  );
  const amazonAppstoreSdkVersions = uniqueMatches(
    googleBuildGradle,
    /com\.amazon\.device:amazon-appstore-sdk:([^"$]+)/g,
  );
  if (horizonBillingVersions.length !== 1) {
    fail(
      `packages/google must use one Horizon Billing Compatibility version, found: ${
        horizonBillingVersions.join(", ") || "(none)"
      }`,
    );
  }
  if (
    horizonBillingVersions.length === 1 &&
    horizonBillingVersions[0] !== "2.0.0"
  ) {
    fail(
      `packages/google must use latest audited Horizon Billing Compatibility 2.0.0, found: ${horizonBillingVersions[0]}`,
    );
  }
  if (horizonPlatformKotlinVersions.length !== 1) {
    fail(
      `packages/google must use one Horizon Platform Kotlin SDK version, found: ${
        horizonPlatformKotlinVersions.join(", ") || "(none)"
      }`,
    );
  }
  if (horizonSerializationVersions.length !== 1) {
    fail(
      `packages/google must use one Horizon serialization version, found: ${
        horizonSerializationVersions.join(", ") || "(none)"
      }`,
    );
  }
  if (amazonAppstoreSdkVersions.length !== 1) {
    fail(
      `packages/google must use one Amazon Appstore SDK version, found: ${
        amazonAppstoreSdkVersions.join(", ") || "(none)"
      }`,
    );
  }
  expectIncludes(
    "packages/google/openiap/build.gradle.kts",
    [
      "com.meta.horizon.billingclient.api:horizon-billing-compatibility:$horizonBillingCompatibilityVersion",
      "com.meta.horizon.platform.sdk:$module:$horizonPlatformKotlinVersion",
      "org.jetbrains.kotlinx:kotlinx-serialization-json:$horizonSerializationVersion",
    ],
    "packages/google Horizon dependency versions",
  );
  expectNotIncludes(
    "packages/google/openiap/build.gradle.kts",
    ["com.meta.horizon.platform.ovr:android-platform-sdk"],
    "packages/google Horizon 2.x must not ship the legacy OVR Platform SDK",
  );

  const mauiProps = read("libraries/maui-iap/src/Directory.Build.props");
  const mauiBillingVersion = mauiProps.match(
    /<MauiPlayBillingVersion>([^<]+)<\/MauiPlayBillingVersion>/,
  )?.[1];
  const mauiAmazonAppstoreSdkVersion = mauiProps.match(
    /<MauiAmazonAppstoreSdkVersion>([^<]+)<\/MauiAmazonAppstoreSdkVersion>/,
  )?.[1];
  const mauiHorizonBillingCompatibilityVersion = mauiProps.match(
    /<MauiHorizonBillingCompatibilityVersion>([^<]+)<\/MauiHorizonBillingCompatibilityVersion>/,
  )?.[1];
  const mauiHorizonPlatformKotlinVersion = mauiProps.match(
    /<MauiHorizonPlatformKotlinVersion>([^<]+)<\/MauiHorizonPlatformKotlinVersion>/,
  )?.[1];
  const mauiHorizonSerializationNuGetVersion = mauiProps.match(
    /<MauiHorizonSerializationNuGetVersion>([^<]+)<\/MauiHorizonSerializationNuGetVersion>/,
  )?.[1];
  const mauiGsonVersion = mauiProps.match(
    /<MauiGsonVersion>([^<]+)<\/MauiGsonVersion>/,
  )?.[1];
  const mauiBillingClientNuGetVersion = mauiProps.match(
    /<MauiBillingClientNuGetVersion>([^<]+)<\/MauiBillingClientNuGetVersion>/,
  )?.[1];
  const mauiGoogleGsonNuGetVersion = mauiProps.match(
    /<MauiGoogleGsonNuGetVersion>([^<]+)<\/MauiGoogleGsonNuGetVersion>/,
  )?.[1];
  const mauiAndroidXActivityVersion = mauiProps.match(
    /<MauiAndroidXActivityVersion>([^<]+)<\/MauiAndroidXActivityVersion>/,
  )?.[1];
  const mauiAndroidXCollectionVersion = mauiProps.match(
    /<MauiAndroidXCollectionVersion>([^<]+)<\/MauiAndroidXCollectionVersion>/,
  )?.[1];
  const mauiAndroidXFragmentVersion = mauiProps.match(
    /<MauiAndroidXFragmentVersion>([^<]+)<\/MauiAndroidXFragmentVersion>/,
  )?.[1];
  const mauiAndroidXFragmentKtxVersion = mauiProps.match(
    /<MauiAndroidXFragmentKtxVersion>([^<]+)<\/MauiAndroidXFragmentKtxVersion>/,
  )?.[1];
  const mauiAndroidXLifecycleVersion = mauiProps.match(
    /<MauiAndroidXLifecycleVersion>([^<]+)<\/MauiAndroidXLifecycleVersion>/,
  )?.[1];
  const mauiAndroidXSavedStateVersion = mauiProps.match(
    /<MauiAndroidXSavedStateVersion>([^<]+)<\/MauiAndroidXSavedStateVersion>/,
  )?.[1];
  expectIncludes(
    "scripts/sync-versions.sh",
    [
      "sync_maui_android_versions",
      "packages/google/openiap/build.gradle.kts",
      "MauiPlayBillingVersion",
      "MauiAmazonAppstoreSdkVersion",
      "MauiHorizonBillingCompatibilityVersion",
      "MauiHorizonPlatformKotlinVersion",
      "MauiHorizonSerializationNuGetVersion",
      "MauiBillingClientNuGetVersion",
      "MauiGoogleGsonNuGetVersion",
      "MauiAndroidXActivityVersion",
      "MauiAndroidXCollectionVersion",
      "MauiAndroidXFragmentKtxVersion",
      "MauiAndroidXLifecycleVersion",
      "mauiGsonVersion",
    ],
    "root version sync must update MAUI Android dependency versions from packages/google",
  );
  expectIncludes(
    "scripts/sync-versions.sh",
    ["./libraries/godot-iap/scripts/sync-versions.sh"],
    "root version sync must update the Godot Android dependency pin",
  );
  expectIncludes(
    ".github/workflows/release-google.yml",
    ["libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap"],
    "Google release workflow must commit the synced Godot Android dependency pin",
  );
  const googleReleaseWorkflow = read(".github/workflows/release-google.yml");
  const godotGdapStageCount = (
    googleReleaseWorkflow.match(
      /git add libraries\/godot-iap\/addons\/godot-iap\/android\/GodotIap\.gdap/g,
    ) ?? []
  ).length;
  if (godotGdapStageCount < 2) {
    fail(
      "Google release workflow must stage the Godot Android dependency pin before commit and after rebase conflict recovery",
    );
  }
  expectIncludes(
    "libraries/maui-iap/src/Directory.Build.props",
    [
      "Generated by scripts/sync-versions.sh",
      "MauiPlayBillingVersion",
      "MauiAmazonAppstoreSdkVersion",
      "MauiHorizonBillingCompatibilityVersion",
      "MauiHorizonPlatformKotlinVersion",
      "MauiHorizonSerializationNuGetVersion",
      "MauiGsonVersion",
      "MauiBillingClientNuGetVersion",
      "MauiGoogleGsonNuGetVersion",
      "MauiAndroidXActivityVersion",
      "MauiAndroidXCollectionVersion",
      "MauiAndroidXFragmentVersion",
      "MauiAndroidXFragmentKtxVersion",
      "MauiAndroidXLifecycleVersion",
      "MauiAndroidXSavedStateVersion",
    ],
    "MAUI Directory.Build.props must be generated by version sync",
  );
  if (!mauiBillingVersion) {
    fail("MAUI Directory.Build.props must define MauiPlayBillingVersion");
  }
  if (!mauiAmazonAppstoreSdkVersion) {
    fail("MAUI Directory.Build.props must define MauiAmazonAppstoreSdkVersion");
  }
  if (!mauiHorizonBillingCompatibilityVersion) {
    fail(
      "MAUI Directory.Build.props must define MauiHorizonBillingCompatibilityVersion",
    );
  }
  if (!mauiHorizonPlatformKotlinVersion) {
    fail(
      "MAUI Directory.Build.props must define MauiHorizonPlatformKotlinVersion",
    );
  }
  if (!mauiHorizonSerializationNuGetVersion) {
    fail(
      "MAUI Directory.Build.props must define MauiHorizonSerializationNuGetVersion",
    );
  }
  if (!mauiGsonVersion) {
    fail("MAUI Directory.Build.props must define MauiGsonVersion");
  }
  if (!mauiBillingClientNuGetVersion) {
    fail(
      "MAUI Directory.Build.props must define MauiBillingClientNuGetVersion",
    );
  }
  if (!mauiGoogleGsonNuGetVersion) {
    fail("MAUI Directory.Build.props must define MauiGoogleGsonNuGetVersion");
  }
  if (!mauiAndroidXActivityVersion) {
    fail("MAUI Directory.Build.props must define MauiAndroidXActivityVersion");
  }
  if (!mauiAndroidXCollectionVersion) {
    fail(
      "MAUI Directory.Build.props must define MauiAndroidXCollectionVersion",
    );
  }
  if (!mauiAndroidXFragmentVersion) {
    fail("MAUI Directory.Build.props must define MauiAndroidXFragmentVersion");
  }
  if (!mauiAndroidXFragmentKtxVersion) {
    fail(
      "MAUI Directory.Build.props must define MauiAndroidXFragmentKtxVersion",
    );
  }
  if (!mauiAndroidXLifecycleVersion) {
    fail("MAUI Directory.Build.props must define MauiAndroidXLifecycleVersion");
  }
  if (!mauiAndroidXSavedStateVersion) {
    fail(
      "MAUI Directory.Build.props must define MauiAndroidXSavedStateVersion",
    );
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
  if (
    amazonAppstoreSdkVersions.length === 1 &&
    mauiAmazonAppstoreSdkVersion !== amazonAppstoreSdkVersions[0]
  ) {
    fail(
      `MAUI Amazon Appstore SDK version ${mauiAmazonAppstoreSdkVersion} must match packages/google ${amazonAppstoreSdkVersions[0]}`,
    );
  }
  if (
    horizonBillingVersions.length === 1 &&
    mauiHorizonBillingCompatibilityVersion !== horizonBillingVersions[0]
  ) {
    fail(
      `MAUI Horizon Billing Compatibility version ${mauiHorizonBillingCompatibilityVersion} must match packages/google ${horizonBillingVersions[0]}`,
    );
  }
  if (
    horizonPlatformKotlinVersions.length === 1 &&
    mauiHorizonPlatformKotlinVersion !== horizonPlatformKotlinVersions[0]
  ) {
    fail(
      `MAUI Horizon Platform Kotlin SDK version ${mauiHorizonPlatformKotlinVersion} must match packages/google ${horizonPlatformKotlinVersions[0]}`,
    );
  }
  if (
    mauiHorizonSerializationNuGetVersion &&
    mauiHorizonSerializationNuGetVersion !== "1.11.0.1"
  ) {
    fail(
      `MAUI Horizon serialization NuGet version must use the audited 1.11.0.1 runtime, found: ${mauiHorizonSerializationNuGetVersion}`,
    );
  }
  if (googleGsonVersions.length === 1) {
    if (mauiGsonVersion !== googleGsonVersions[0]) {
      fail(
        `MAUI Android Gson Maven version ${mauiGsonVersion} must match packages/google ${googleGsonVersions[0]}`,
      );
    }
    const mauiAndroidGradleProperties = read(
      "libraries/maui-iap/android/gradle.properties",
    );
    const mauiAndroidGsonVersion = mauiAndroidGradleProperties.match(
      /^mauiGsonVersion=(.+)$/m,
    )?.[1];
    if (!mauiAndroidGsonVersion) {
      fail("MAUI Android gradle.properties must define mauiGsonVersion");
    } else if (mauiAndroidGsonVersion !== googleGsonVersions[0]) {
      fail(
        `MAUI Android Gradle Gson version ${mauiAndroidGsonVersion} must match packages/google ${googleGsonVersions[0]}`,
      );
    }
  }
  expectIncludes(
    "libraries/maui-iap/android/openiap/build.gradle.kts",
    [
      "googleOpenIapBuildFile",
      'readGoogleAndroidInt("compileSdk")',
      'readGoogleAndroidInt("minSdk")',
      "readMauiAndroidMinSdk()",
      'readGoogleDependencyVersion("androidx.core:core")',
      'readGoogleVariable("coroutinesVersion")',
      "compileSdk = googleCompileSdk",
      "minSdk = maxOf(googleMinSdk, mauiAndroidMinSdk)",
      "openIapAndroidStore",
      "openiap-google-amazon",
      "openiap-google-horizon",
      'missingDimensionStrategy("platform", openIapAndroidStore)',
      "mauiGsonVersion",
      'implementation("androidx.core:core:$googleCoreVersion")',
      "com.google.code.gson:gson:$gsonVersion",
      'implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$googleCoroutinesVersion")',
    ],
    "MAUI Android facade Gson dependency version",
  );
  expectIncludes(
    "libraries/maui-iap/android/settings.gradle.kts",
    [
      "googleRootBuildFile",
      'googlePluginVersion("com.android.library")',
      'googlePluginVersion("org.jetbrains.kotlin.android")',
      "openiap-google-horizon",
      "openiap-google-amazon",
    ],
    "MAUI Android Gradle plugin versions must derive from packages/google",
  );
  expectIncludes(
    "libraries/maui-iap/android/build.gradle.kts",
    [
      'id("com.android.library") apply false',
      'id("org.jetbrains.kotlin.android") apply false',
    ],
    "MAUI Android root Gradle plugins",
  );
  expectNotIncludes(
    "libraries/maui-iap/android/openiap/build.gradle.kts",
    [
      "compileSdk = 35",
      "minSdk = 24",
      "androidx.core:core-ktx:",
      "kotlinx-coroutines-android:1.9.0",
    ],
    "MAUI Android facade versions must derive from openiap-google and MAUI metadata",
  );
  for (const mauiGradlePluginFile of [
    "libraries/maui-iap/android/settings.gradle.kts",
    "libraries/maui-iap/android/build.gradle.kts",
  ]) {
    expectNotIncludes(
      mauiGradlePluginFile,
      ['version "8.7.3"', 'version "8.13.2"', 'version "2.2.0"'],
      `${mauiGradlePluginFile} must not hardcode Google Gradle plugin versions`,
    );
  }
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui.Bindings.Android/OpenIap.Maui.Bindings.Android.csproj",
    [
      "Xamarin.Android.Google.BillingClient",
      'Version="$(MauiBillingClientNuGetVersion)"',
      "GoogleGson",
      'Version="$(MauiGoogleGsonNuGetVersion)"',
      'Version="$(MauiKotlinStdLibVersion)"',
      'Version="$(MauiKotlinCoroutinesVersion)"',
      "OpenIapAndroidStore",
      "OpenIapGoogleAarFlavor",
      "openiap-$(OpenIapGoogleAarFlavor)-release.aar",
      "com.amazon.device:amazon-appstore-sdk",
      'Version="$(MauiAmazonAppstoreSdkVersion)"',
      "com.meta.horizon.billingclient.api:horizon-billing-compatibility",
      'Version="$(MauiHorizonBillingCompatibilityVersion)"',
      "com.meta.horizon.platform.sdk:core-kotlin",
      "com.meta.horizon.platform.sdk:user-age-category-kotlin",
      "com.meta.horizon.platform.sdk:iap-kotlin",
      'Version="$(MauiHorizonPlatformKotlinVersion)"',
      "Xamarin.KotlinX.Serialization.Json",
      "Xamarin.KotlinX.Serialization.Json.Jvm",
      'Version="$(MauiHorizonSerializationNuGetVersion)"',
    ],
    "MAUI Android binding dependency versions",
  );
  expectNotIncludes(
    "libraries/maui-iap/src/OpenIap.Maui.Bindings.Android/OpenIap.Maui.Bindings.Android.csproj",
    [
      'Version="3.0.0"',
      'Version="3.1.8"',
      'Version="18.5.0"',
      'Version="18.9.0"',
      'Version="19.0.0"',
      'Version="18.2.0"',
    ],
    "MAUI Android binding Google Maven dependencies must use shared props",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    [
      "net10.0",
      "net10.0-android",
      "net10.0-ios",
      "net10.0-maccatalyst",
      "Xamarin.Android.Google.BillingClient",
      'Version="$(MauiBillingClientNuGetVersion)"',
      "Condition=\"'$(OpenIapGoogleAarFlavor)' == 'play'\"",
      "GoogleGson",
      'Version="$(MauiGoogleGsonNuGetVersion)"',
      "Xamarin.AndroidX.Activity",
      'Version="$(MauiAndroidXActivityVersion)"',
      "Xamarin.AndroidX.Activity.Ktx",
      "Xamarin.AndroidX.Collection.Ktx",
      'Version="$(MauiAndroidXCollectionVersion)"',
      "Xamarin.AndroidX.Fragment",
      'Version="$(MauiAndroidXFragmentVersion)"',
      "Xamarin.AndroidX.Fragment.Ktx",
      'Version="$(MauiAndroidXFragmentKtxVersion)"',
      "Xamarin.AndroidX.Lifecycle.Runtime",
      'Version="$(MauiAndroidXLifecycleVersion)"',
      "Xamarin.AndroidX.Lifecycle.Runtime.Ktx",
      "Xamarin.AndroidX.Lifecycle.ViewModel.Ktx",
      "Xamarin.AndroidX.SavedState",
      'Version="$(MauiAndroidXSavedStateVersion)"',
      "Xamarin.AndroidX.SavedState.SavedState.Ktx",
      'Version="$(MauiKotlinStdLibVersion)"',
      'Version="$(MauiKotlinCoroutinesVersion)"',
      "openiap-release.aar",
      "OpenIapAndroidStore",
      "OpenIapGoogleAarFlavor",
      "openiap-$(OpenIapGoogleAarFlavor)-release.aar",
      "com.amazon.device:amazon-appstore-sdk",
      'Version="$(MauiAmazonAppstoreSdkVersion)"',
      "com.meta.horizon.billingclient.api:horizon-billing-compatibility",
      'Version="$(MauiHorizonBillingCompatibilityVersion)"',
      "com.meta.horizon.platform.sdk:core-kotlin",
      "com.meta.horizon.platform.sdk:user-age-category-kotlin",
      "com.meta.horizon.platform.sdk:iap-kotlin",
      'Version="$(MauiHorizonPlatformKotlinVersion)"',
      "Xamarin.KotlinX.Serialization.Json",
      "Xamarin.KotlinX.Serialization.Json.Jvm",
      'Version="$(MauiHorizonSerializationNuGetVersion)"',
    ],
    "MAUI Android package dependency versions",
  );
  expectIncludes(
    "libraries/maui-iap/Directory.Build.props",
    [
      "DefaultItemExcludes",
      "obj/**;bin/**",
      "<MauiControlsVersion>10.0.90</MauiControlsVersion>",
      "<MicrosoftExtensionsLoggingDebugVersion>10.0.10</MicrosoftExtensionsLoggingDebugVersion>",
      "BaseIntermediateOutputPath",
      "BaseOutputPath",
      "$(OpenIapAndroidStore)",
    ],
    "MAUI Android store builds must use isolated MSBuild outputs",
  );
  expectIncludes(
    "libraries/maui-iap/src/Directory.Build.props",
    ['<Import Project="..\\Directory.Build.props" />'],
    "generated MAUI dependency props must preserve store output isolation",
  );
  expectNotIncludes(
    "packages/apple/Sources/OpenIapModule+ObjC.swift",
    ["transactionDate: Date().timeIntervalSince1970"],
    "Apple Objective-C bridge transaction dates must use epoch milliseconds",
  );
  expectNotIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    [
      '<BuildOutputInPackage Include="$(OutputPath)*.aar"',
      "com.meta.horizon.platform.ovr:android-platform-sdk",
      "MauiHorizonPlatformSdkVersion",
      "org.jetbrains.kotlinx:kotlinx-serialization-json",
      "MauiHorizonSerializationVersion",
    ],
    "MAUI package must not fat-bundle transitive Google AARs",
  );
  expectNotIncludes(
    "libraries/maui-iap/src/OpenIap.Maui.Bindings.Android/OpenIap.Maui.Bindings.Android.csproj",
    [
      "com.meta.horizon.platform.ovr:android-platform-sdk",
      "MauiHorizonPlatformSdkVersion",
      "org.jetbrains.kotlinx:kotlinx-serialization-json",
      "MauiHorizonSerializationVersion",
    ],
    "MAUI Horizon 2.x bindings must not ship the legacy OVR Platform SDK",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    [
      "net10.0;net10.0-android;net10.0-ios;net10.0-maccatalyst",
      'Include="Microsoft.Maui.Controls" Version="$(MauiControlsVersion)" PrivateAssets="all"',
    ],
    "MAUI 2.x package must target supported .NET 10 frameworks only",
  );
  expectIncludes(
    "libraries/maui-iap/example/OpenIap.Maui.Example/OpenIap.Maui.Example.csproj",
    [
      "net10.0-android",
      "net10.0-ios",
      "net10.0-maccatalyst",
      'Include="Microsoft.Maui.Controls" Version="$(MauiControlsVersion)"',
      'Include="Microsoft.Extensions.Logging.Debug" Version="$(MicrosoftExtensionsLoggingDebugVersion)"',
    ],
    "MAUI example app must validate net10 target frameworks",
  );
  for (const mauiWorkflow of [
    ".github/workflows/ci-maui-iap.yml",
    ".github/workflows/release-maui.yml",
  ]) {
    expectIncludes(
      mauiWorkflow,
      [
        'dotnet-version: "10.0.x"',
        "net10.0",
        "net10.0-android",
        "net10.0-ios",
        "net10.0-maccatalyst",
      ],
      "MAUI workflows must validate net10 target frameworks",
    );
  }
  expectIncludes(
    "packages/docs/src/pages/docs/setup/maui.tsx",
    [
      ".NET 10 SDK",
      "Google Play Billing, Play Services",
      "net10.0-ios;net10.0-android;net10.0-maccatalyst",
      "OpenIap.Maui 2.x",
      "supports .NET 10 only",
    ],
    "MAUI setup docs must describe net10 and NuGet Google dependency shape",
  );
  for (const net10OnlyFile of [
    "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    "libraries/maui-iap/src/OpenIap.Maui.Bindings.Android/OpenIap.Maui.Bindings.Android.csproj",
    "libraries/maui-iap/src/OpenIap.Maui.Bindings.iOS/OpenIap.Maui.Bindings.iOS.csproj",
    "libraries/maui-iap/tests/OpenIap.Maui.ContractTests/OpenIap.Maui.ContractTests.csproj",
    "libraries/maui-iap/tests/OpenIap.Maui.Tests/OpenIap.Maui.Tests.csproj",
    "libraries/maui-iap/example/OpenIap.Maui.Example/OpenIap.Maui.Example.csproj",
    "libraries/maui-iap/.vscode/launch.json",
    "libraries/maui-iap/.vscode/run_android.sh",
    "libraries/maui-iap/.vscode/run_ios_device.sh",
    "libraries/maui-iap/.vscode/run_ios_simulator.sh",
    ".github/workflows/ci-maui-iap.yml",
    ".github/workflows/release-maui.yml",
    ".claude/commands/e2e-tests.md",
    ".claude/commands/verify-all.md",
    "libraries/maui-iap/README.md",
    "libraries/maui-iap/example/README.md",
    "libraries/maui-iap/CLAUDE.md",
    "libraries/maui-iap/CONVENTION.md",
    "knowledge/internal/04-platform-packages.md",
    "packages/docs/src/pages/docs/setup/store/amazon.tsx",
    "packages/docs/src/pages/docs/setup/store/horizon.tsx",
  ]) {
    expectNotIncludes(
      net10OnlyFile,
      ["net9.0", ".NET 9"],
      "MAUI 2.x support files must not restore out-of-support .NET MAUI 9 targets",
    );
  }
  expectIncludes(
    "libraries/maui-iap/tests/OpenIap.Maui.Tests/OpenIap.Maui.Tests.csproj",
    [
      'Include="Microsoft.NET.Test.Sdk" Version="18.8.1"',
      'Include="xunit" Version="2.9.3"',
      'Include="xunit.analyzers" Version="1.27.0" PrivateAssets="all"',
      'Include="xunit.runner.visualstudio" Version="3.1.5"',
    ],
    "MAUI test dependencies must stay current",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/android/settings.gradle",
    ["new File(settingsDir, '../../../packages/google/openiap')"],
    "Flutter Android local OpenIAP module hint",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/android/settings.gradle",
    [
      "git clone https://github.com/hyodotdev/openiap-google",
      "/path/to/openiap/packages/google/openiap",
      "switch dependency",
    ],
    "Flutter Android local OpenIAP module hint must match monorepo flow",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/CONTRIBUTING.md",
    [
      "project(':openiap').projectDir = new File(settingsDir, '../../../packages/google/openiap')",
      "`android/build.gradle` dependency changes are needed.",
    ],
    "Flutter local OpenIAP debugging docs",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/CONTRIBUTING.md",
    [
      "git clone https://github.com/hyodotdev/openiap-google",
      'debugImplementation project(":openiap")',
      'releaseImplementation "io.github.hyochan.openiap:openiap-google:${openiapGoogleVersion}"',
    ],
    "Flutter local OpenIAP debugging docs must match automatic local project selection",
  );

  for (const [label, filePath] of [
    ["React Native Android", "libraries/react-native-iap/android/build.gradle"],
    ["MAUI Android", "libraries/maui-iap/android/openiap/build.gradle.kts"],
    [
      "Godot Android GDAP",
      "libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap",
    ],
  ]) {
    const coroutineVersions = uniqueMatches(
      read(filePath),
      /kotlinx-coroutines-android:([0-9.]+)/g,
    );
    for (const version of coroutineVersions) {
      if (
        googleCoroutineVersions.length === 1 &&
        version !== googleCoroutineVersions[0]
      ) {
        fail(
          `${label} coroutines version ${version} must match packages/google ${googleCoroutineVersions[0]}`,
        );
      }
    }
  }
  if (googleCoroutineVersions.length === 1) {
    expectIncludes(
      "libraries/react-native-iap/android/gradle.properties",
      [
        `NitroIap_coroutinesVersion=${googleCoroutineVersions[0]}`,
        "NitroIap_playServicesBaseVersion=18.10.0",
        "NitroIap_junitVersion=",
      ],
      "React Native Android coroutines fallback version",
    );
  }
  expectIncludes(
    "libraries/react-native-iap/android/build.gradle",
    [
      "googleRootBuildFile",
      "googlePluginVersion('com.android.library')",
      "googlePluginVersion('org.jetbrains.kotlin.android')",
      "NitroIap_androidGradlePluginVersion",
      "resolveOpenIapGoogleBuildFile()",
      "readOpenIapGoogleVariable(googleOpenIapBuildFile, 'coroutinesVersion')",
      "readOpenIapGoogleDependencyVersion(googleOpenIapBuildFile, 'junit:junit')",
      'def playServicesBaseVersion = getExtOrDefault("playServicesBaseVersion")',
      "def junitVersion = readOpenIapGoogleDependencyVersion",
      'implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion"',
      'implementation "com.google.android.gms:play-services-base:$playServicesBaseVersion"',
      'testImplementation "junit:junit:$junitVersion"',
      'namespace = "com.margelo.nitro.iap"',
      "buildConfig = true",
      "prefab = true",
    ],
    "React Native Android Gradle versions and syntax",
  );
  expectNotIncludes(
    "libraries/react-native-iap/android/build.gradle",
    [
      "com.android.tools.build:gradle:8.12.1",
      "org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.0",
      "implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0'",
      "implementation 'com.google.android.gms:play-services-base:18.5.0'",
      "testImplementation 'junit:junit:4.13.2'",
      'namespace "com.margelo.nitro.iap"',
      'ndkVersion getExtOrDefault("ndkVersion")',
      'minSdkVersion getExtOrIntegerDefault("minSdkVersion")',
      'targetSdkVersion getExtOrIntegerDefault("targetSdkVersion")',
      "buildConfig true",
      "prefab true",
    ],
    "React Native Android Gradle must avoid hardcoded drift and deprecated syntax",
  );
  expectIncludes(
    "libraries/expo-iap/android/build.gradle",
    ['testImplementation "org.json:json:20260719"'],
    "Expo Android unit tests must use the current org.json artifact",
  );
  expectNotIncludes(
    "libraries/expo-iap/android/build.gradle",
    ["kotlin-stdlib-jdk7", "org.json:json:20180813"],
    "Expo Android dependencies must not retain merged or stale artifacts",
  );
  expectIncludes(
    ".github/workflows/release-expo.yml",
    [
      "Consumer install smoke test (pre-tag build)",
      "bun run verify:consumer-install --pack-ignore-scripts",
    ],
    "Expo releases must build and smoke-test the package before tagging",
  );
  expectNotIncludes(
    ".github/workflows/release-expo.yml",
    ["Prepare package (build + codegen)", "run: bun run prepare"],
    "Expo releases must not rely on the no-op prepare command before tagging",
  );
  expectIncludes(
    "libraries/expo-iap/package.json",
    ['"prepare": "bun run build:plugin'],
    "Expo workspace installs must build the config plugin explicitly",
  );
  expectNotIncludes(
    "libraries/expo-iap/package.json",
    ["expo-module prepare"],
    "Expo package lifecycle must not rely on the removed prepare behavior",
  );
  expectIncludes(
    ".github/workflows/ci-expo-iap.yml",
    ["Build config plugin", "run: bun run build:plugin"],
    "Expo iOS CI must build the config plugin before prebuild",
  );
  expectIncludes(
    "libraries/react-native-iap/example/android/app/build.gradle",
    [
      "ndkVersion = rootProject.ext.ndkVersion",
      "compileSdk = rootProject.ext.compileSdkVersion",
      'namespace = "dev.hyo.martie"',
      "signingConfig = signingConfigs.debug",
    ],
    "React Native example Android Gradle syntax",
  );
  expectNotIncludes(
    "libraries/react-native-iap/example/android/app/build.gradle",
    [
      "ndkVersion rootProject.ext.ndkVersion",
      "compileSdk rootProject.ext.compileSdkVersion",
      'namespace "dev.hyo.martie"',
      "signingConfig signingConfigs.debug",
    ],
    "React Native example Android Gradle must avoid deprecated syntax",
  );

  for (const gradleFile of [
    "libraries/expo-iap/android/build.gradle",
    "libraries/flutter_inapp_purchase/example/android/app/build.gradle",
    "libraries/flutter_inapp_purchase/android/build.gradle",
    "libraries/godot-iap/android/build.gradle.kts",
    "libraries/maui-iap/android/openiap/build.gradle.kts",
    "libraries/react-native-iap/android/build.gradle",
    "packages/google/Example/build.gradle.kts",
    "packages/google/openiap/build.gradle.kts",
  ]) {
    expectIncludes(
      gradleFile,
      ["compilerOptions", "JvmTarget.JVM_17"],
      `${gradleFile} Kotlin compiler target`,
    );
    expectNotIncludes(
      gradleFile,
      ["kotlinOptions", 'jvmTarget = "17"', "jvmTarget = '17'"],
      `${gradleFile} Kotlin compiler target`,
    );
  }

  for (const kotlinVersionFile of [
    "libraries/flutter_inapp_purchase/android/gradle.properties",
    "libraries/flutter_inapp_purchase/example/android/gradle.properties",
    "libraries/flutter_inapp_purchase/example/android/settings.gradle",
    "libraries/godot-iap/android/gradle.properties",
  ]) {
    expectIncludes(
      kotlinVersionFile,
      ["2.4.10"],
      `${kotlinVersionFile} Kotlin version`,
    );
    expectNotIncludes(
      kotlinVersionFile,
      ["2.0.21", "2.1.20", "2.1.0"],
      `${kotlinVersionFile} Kotlin version`,
    );
  }
  expectIncludes(
    "libraries/react-native-iap/android/gradle.properties",
    ["NitroIap_kotlinVersion=2.2.0"],
    "React Native standalone Kotlin fallback must remain consumer-compatible",
  );
  expectIncludes(
    "packages/google/scripts/verify-kotlin-2.1-consumer.sh",
    [
      "compatibility/kotlin-2.1-consumer",
      "play:openiap-google",
      "horizon:openiap-google-horizon",
      "amazon:openiap-google-amazon",
      "compileDebugKotlin",
    ],
    "Google Kotlin consumer compatibility verifier",
  );
  for (const workflowFile of [
    ".github/workflows/ci.yml",
    ".github/workflows/release-google.yml",
  ]) {
    expectIncludes(
      workflowFile,
      ["bash scripts/verify-kotlin-2.1-consumer.sh"],
      `${workflowFile} Kotlin consumer compatibility gate`,
    );
  }
  const kotlinConsumerGateIndex = googleReleaseWorkflow.indexOf(
    "bash scripts/verify-kotlin-2.1-consumer.sh",
  );
  const mavenCentralPublishIndex = googleReleaseWorkflow.indexOf(
    ":openiap:publishAndReleaseToMavenCentral",
  );
  if (
    kotlinConsumerGateIndex < 0 ||
    mavenCentralPublishIndex < 0 ||
    kotlinConsumerGateIndex >= mavenCentralPublishIndex
  ) {
    fail(
      ".github/workflows/release-google.yml must verify Kotlin 2.1.20 consumers before Maven Central publication",
    );
  }
  expectIncludes(
    "packages/google/gradle.properties",
    ["COMPOSE_UI_VERSION=1.11.4"],
    "Google Compose UI version",
  );
  for (const googleGradleFile of [
    "packages/google/openiap/build.gradle.kts",
    "packages/google/Example/build.gradle.kts",
  ]) {
    expectIncludes(
      googleGradleFile,
      ['?: "1.11.4"'],
      `${googleGradleFile} Compose UI fallback`,
    );
    expectNotIncludes(
      googleGradleFile,
      ['?: "1.10.6"'],
      `${googleGradleFile} must not retain the superseded Compose UI fallback`,
    );
  }
  for (const kmpCatalog of [
    "libraries/kmp-iap/gradle/libs.versions.toml",
    "libraries/kmp-iap/example/gradle/libs.versions.toml",
  ]) {
    expectIncludes(
      kmpCatalog,
      [
        '= "1.10.3"',
        "1.11.x no longer resolves the iosX64 variants",
        "1.10.3 is the latest stable compatible release",
      ],
      `${kmpCatalog} Compose compatibility cap`,
    );
  }
  expectIncludes(
    "libraries/kmp-iap/CLAUDE.md",
    [
      "Kotlin `2.4.10` is the validated compiler line",
      "Keep Compose Multiplatform at `1.10.3`",
      "Compose `1.11.x` does not resolve the required iOS x64 variants",
      "Do not remove a supported target solely to make a dependency upgrade pass",
    ],
    "KMP Compose compatibility guidance",
  );
  expectIncludes(
    "libraries/react-native-iap/README.md",
    [
      "React Native 0.79 or later",
      "Node.js 18 or later",
      "Android API level 23+",
      "Kotlin 2.1.20 or later",
      "versions supplied by the host React Native project",
      "validated against Kotlin `2.1.20`",
      "standalone source-build fallback is Kotlin `2.2.0`",
    ],
    "React Native requirements must distinguish host compatibility from standalone fallbacks",
  );
  expectNotIncludes(
    "libraries/react-native-iap/README.md",
    [
      "React Native 0.64 or later",
      "Node.js 16 or later",
      "Android API level 21+",
      "requires Kotlin 2.4.10+",
    ],
    "React Native requirements must not retain stale or incompatible minimums",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/setup/expo.tsx",
    [
      "SDK 57 / React Native 0.86",
      "SDK 57: iOS 16.4+",
      "Android 7 / API 24+",
      "SDK 57: Node.js 22.13.x",
      "54–56: Node.js 20.19.x",
      "SDK 53: Node.js 20.18.x",
      "react-native-tvos@0.86.2-0",
      '"@react-native-tvos/config-tv": "^0.1.6"',
      "deploymentTarget: isTV ? '16.0' : '16.4'",
      "deploymentTarget: '16.4'",
    ],
    "Expo setup docs must match the validated SDK 57 toolchain",
  );
  expectNotIncludes(
    "packages/docs/src/pages/docs/setup/expo.tsx",
    [
      "SDK 53–56: Node.js 20.x",
      "SDK 53: Node.js 20+",
      "react-native-tvos@0.81.5-1",
      '"@react-native-tvos/config-tv": "^0.1.4"',
      "deploymentTarget: isTV ? '16.0' : '15.1'",
      "Do not force Kotlin 2.3.x",
    ],
    "Expo setup docs must not retain superseded SDK 57 prerequisites",
  );
  expectIncludes(
    "libraries/expo-iap/plugin/src/withLocalOpenIAP.ts",
    ["2.1.20"],
    "Expo SDK 57 local OpenIAP Kotlin version",
  );
  expectNotIncludes(
    "libraries/expo-iap/plugin/src/withLocalOpenIAP.ts",
    ["2.4.10"],
    "Expo local OpenIAP must not inject the standalone Google Kotlin version",
  );
  for (const kotlinVersionFile of [
    "libraries/expo-iap/plugin/build/withLocalOpenIAP.js",
  ]) {
    expectOptionalIncludes(
      kotlinVersionFile,
      ["2.1.20"],
      `${kotlinVersionFile} Kotlin version`,
    );
    expectOptionalNotIncludes(
      kotlinVersionFile,
      ["2.4.10"],
      `${kotlinVersionFile} Kotlin version`,
    );
  }
  expectIncludes(
    "libraries/flutter_inapp_purchase/android/build.gradle",
    ["readRequiredAndroidGradleProperty(projectDir, 'openIapKotlinVersion')"],
    "Flutter Android build.gradle must read Kotlin fallback from gradle.properties",
  );
  expectIncludes(
    "libraries/react-native-iap/android/build.gradle",
    ["configuredVersion('kotlinVersion', 'NitroIap_kotlinVersion')"],
    "React Native Android build.gradle must read Kotlin fallback from gradle.properties",
  );
  expectIncludes(
    "packages/apple/Sources/OpenIapVersion.swift",
    [
      'Bundle.module.url(forResource: "openiap-versions", withExtension: "json")',
      "cocoaPodsVersionURL()",
      'bundle.url(forResource: "OpenIAP", withExtension: "bundle")',
      'version(for: "apple")',
      'version(for: "spec")',
    ],
    "Apple OpenIAP runtime version",
  );
  expectIncludes(
    "packages/apple/openiap.podspec",
    ["s.resources", "Sources/openiap-versions.json", "openiap-versions.json"],
    "Apple podspec version resource",
  );
  expectNotIncludes(
    "packages/apple/Sources/OpenIapVersion.swift",
    ["1.2.23", "1.2.2", "static let current", "static let gqlVersion"],
    "Apple OpenIAP runtime version",
  );
  expectIncludes(
    "packages/apple/wrapper/project.yml",
    ['MARKETING_VERSION: "$(OPENIAP_MARKETING_VERSION)"'],
    "Apple wrapper marketing version",
  );
  expectIncludes(
    "packages/apple/scripts/build-xcframework.sh",
    [
      "openiap-versions.json",
      "read_openiap_version()",
      'python3 - "$VERSIONS_FILE" "$1"',
      'APPLE_VERSION="$(read_openiap_version apple)"',
      'OPENIAP_MARKETING_VERSION="${APPLE_VERSION}"',
    ],
    "Apple xcframework marketing version",
  );
  expectIncludes(
    "packages/apple/scripts/build-xcframework.sh",
    [
      'EXPECTED_INSTALL_NAME="@rpath/OpenIAP.framework/OpenIAP"',
      'LD_DYLIB_INSTALL_NAME="${EXPECTED_INSTALL_NAME}"',
      "validate_install_names",
    ],
    "Apple xcframework install name",
  );
  expectIncludes(
    "packages/apple/wrapper/project.yml",
    ['LD_DYLIB_INSTALL_NAME: "@rpath/$(EXECUTABLE_PATH)"'],
    "Apple wrapper install name",
  );
  expectNotIncludes(
    "packages/apple/scripts/bump-version.sh",
    ["OpenIapVersion.swift fallback", "Sources/OpenIapVersion.swift"],
    "Apple bump-version should not edit runtime version source",
  );
}

function checkReleaseNoteGroupingGuidance() {
  expectIncludes(
    ".codex/skills/generate-doc/SKILL.md",
    [
      "## Multi-package Release Trains",
      "project decision recorded from issue #206",
      "Group notable changes under the affected platform package or framework",
      "the next major for breaking public API or type removals",
      "never infer or auto-align it from Apple and Google",
      "Before naming any package's next major",
      "migration schedule. The release train must include every public removal",
    ],
    "generate-doc package-specific release guidance",
  );
  expectIncludes(
    "knowledge/internal/05-docs-patterns.md",
    [
      "### Package-specific grouping for shared releases",
      "package-specific changelog requirement",
      "from issue #206 without duplicating release history",
      'Do not replace package-specific behavior with a generic "framework parity"',
    ],
    "internal package-specific release guidance",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/updates/releases.tsx",
    [
      "multi-store-billing-9-1-sdk-release-2026-07-11",
      "Platform packages and IAPKit",
      "Framework libraries",
      "<strong>react-native-iap 15.4.0</strong>",
      "<strong>expo-iap 4.4.0</strong>",
      "<strong>flutter_inapp_purchase 9.4.0</strong>",
      "<strong>godot-iap 2.4.0</strong>",
      "<strong>kmp-iap 2.4.0</strong>",
      "<strong>OpenIap.Maui 1.2.1</strong>",
      "https://github.com/hyodotdev/openiap/issues/206",
    ],
    "current package-specific release note",
  );
  expectNotIncludes(
    "packages/docs/src/pages/docs/updates/releases.tsx",
    [
      "amazon-config-plugin-option-shape-2026-07-03",
      "fireos-support-2026-05-23",
      "react-native-iap 15.4.0-rc.",
      "expo-iap 4.4.0-rc.",
      "flutter_inapp_purchase 9.4.0-rc.",
      "godot-iap 2.4.0-rc.",
      "kmp-iap 2.4.0-rc.",
      "OpenIap.Maui 1.2.1-rc.",
    ],
    "current release note must contain stable package entries only",
  );
}

function checkXcode27StoreKitCoverage() {
  expectIncludes(
    "packages/gql/src/api-ios.graphql",
    ["presentCodeRedemptionSheetIOS: PurchaseIOS"],
    "Xcode 27 offer-code redemption result contract",
  );
  expectIncludes(
    "packages/gql/src/type-ios.graphql",
    [
      "SubscriptionBundle",
      "SubscriptionSuite",
      "type BundledSubscriptionIOS",
      "bundledSubscriptionsIOS: [BundledSubscriptionIOS!]",
      "bundleOriginalTransactionIdIOS: String",
      "bundleTransactionIdIOS: String",
      "previousOriginalTransactionIdIOS: String",
      "bundleOriginalTransactionId: String",
      "willUnbundle: Boolean",
      "revocationTypeIOS: String",
      "revocationDate: Float",
      "storeType: String",
    ],
    "Xcode 27 StoreKit schema coverage",
  );
  expectIncludes(
    "packages/apple/Sources/Helpers/StoreKitTypesBridge.swift",
    [
      "info.bundledSubscriptions.map",
      "type == .subscriptionBundle || type == .subscriptionSuite",
      "transaction.bundleOriginalTransactionID",
      "transaction.bundleTransactionID",
      "transaction.previousOriginalTransactionID",
      "info.bundleOriginalTransactionID",
      "info.willUnbundle",
      "ownership == .assigned",
      "revocation == .upgradedToBundle",
      "transaction.revocationType?.rawValue",
      "details.partners.map",
    ],
    "Xcode 27 StoreKit native mapping",
  );
  expectIncludes(
    "packages/apple/Sources/OpenIapModule.swift",
    [
      "AppStore.presentOfferCodeRedeemSheet(",
      "StoreKitTypesBridge.isAutoRenewingSubscriptionProductType",
      "revocationDateValue = transaction.revocationDate?.milliseconds",
      "storeTypeValue = transaction.storeType.rawValue",
    ],
    "Xcode 27 Apple module behavior",
  );
  expectIncludes(
    "libraries/react-native-iap/ios/RnIapHelper.swift",
    ["bundledSubscriptionsIOS: nil"],
    "React Native iOS minimal-product StoreKit 27 initializer parity",
  );
  expectIncludes(
    "libraries/react-native-iap/android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt",
    ["bundledSubscriptionsIOS = null"],
    "React Native Android product StoreKit 27 initializer parity",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/updates/releases.tsx",
    [
      "Bundle/Suite product types",
      "Group Purchase seat assignment",
      "Commerce item partners",
      "assignment-revocation metadata",
      "managed acquisition platform",
      "AppTransaction.all",
      "scene-based lifecycle",
      "UIWindowSceneDelegate",
    ],
    "Xcode 27 major release note",
  );
  expectIncludes(
    "packages/docs/src/pages/docs/ios-setup.tsx",
    [
      "xcode-27-scene-lifecycle",
      "UIApplicationSceneManifest",
      "configurationForConnecting",
      "UIWindowSceneDelegate",
      "tn3208-preparing-your-apps-launch-screen",
    ],
    "Xcode 27 host lifecycle migration guide",
  );
  expectIncludes(
    "libraries/expo-iap/example/plugins/withIos27SceneLifecycle.js",
    [
      "UIApplicationSceneManifest",
      "configurationForConnecting connectingSceneSession",
      "UIWindow(windowScene: windowScene)",
      "appDelegate?.window = window",
      "appDelegate?.applicationDidBecomeActive",
      "appDelegate?.applicationDidEnterBackground",
    ],
    "Expo Xcode 27 scene lifecycle fixture",
  );
  expectIncludes(
    "libraries/react-native-iap/example/ios/example/AppDelegate.swift",
    [
      "configurationForConnecting connectingSceneSession",
      "configuration.delegateClass = SceneDelegate.self",
      "var window: UIWindow?",
    ],
    "React Native Xcode 27 app delegate",
  );
  expectNotIncludes(
    "libraries/react-native-iap/example/ios/example/AppDelegate.swift",
    ["UIWindow(frame: UIScreen.main.bounds)"],
    "React Native Xcode 27 app delegate must not own the scene window",
  );
  expectIncludes(
    "libraries/react-native-iap/example/ios/example/SceneDelegate.swift",
    [
      "UIWindowSceneDelegate",
      "UIWindow(windowScene: windowScene)",
      "appDelegate.window = window",
      "factory.startReactNative(",
      "connectionOptions.userActivities.first",
      '"UIApplicationLaunchOptionsUserActivityKey": userActivity',
    ],
    "React Native Xcode 27 scene delegate",
  );
  expectIncludes(
    "libraries/react-native-iap/example/ios/example/Info.plist",
    [
      "<key>UIApplicationSceneManifest</key>",
      "$(PRODUCT_MODULE_NAME).SceneDelegate",
    ],
    "React Native Xcode 27 scene manifest",
  );
  expectIncludes(
    "libraries/react-native-iap/example/Gemfile",
    ["gem 'nkf'"],
    "React Native Ruby 3.4 CocoaPods compatibility",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/example/ios/Runner/Info.plist",
    [
      "<key>UIApplicationSceneManifest</key>",
      "<string>FlutterSceneDelegate</string>",
    ],
    "Flutter Xcode 27 scene manifest",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/example/ios/Runner/Info.plist",
    ["<key>_UIApplicationSceneManifest</key>"],
    "Flutter Xcode 27 scene manifest must use the canonical key",
  );
  for (const workflowPath of [
    ".github/workflows/ci-react-native-iap.yml",
    ".github/workflows/ci-expo-iap.yml",
  ]) {
    expectIncludes(
      workflowPath,
      [
        "ios-xcode-27:",
        "if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository",
        "runs-on: xcode-27",
        "generic/platform=iOS Simulator",
        "CODE_SIGNING_ALLOWED=NO",
        "packages/apple/Sources/**",
        "packages/apple/Package.swift",
        "openiap-versions.json",
      ],
      `${workflowPath} Xcode 27 scene lifecycle build`,
    );
  }
  for (const workflowPath of [
    ".github/workflows/ci-flutter-inapp-purchase.yml",
    ".github/workflows/release-flutter.yml",
  ]) {
    expectIncludes(
      workflowPath,
      [
        'flutter-version: "3.44.9"',
        "bash scripts/verify-apple-swiftpm-consumer-build.sh",
      ],
      `${workflowPath} Flutter Xcode 27 SwiftPM example build`,
    );
  }
  for (const workflowPath of [
    ".github/workflows/ci-flutter-inapp-purchase.yml",
    ".github/workflows/release-flutter.yml",
  ]) {
    expectIncludes(
      workflowPath,
      ["bash scripts/verify-ios-cocoapods-consumer-build.sh"],
      `${workflowPath} Flutter CocoaPods consumer build`,
    );
  }
  expectIncludes(
    ".github/workflows/ci-flutter-inapp-purchase.yml",
    [
      "packages/apple/Sources/**",
      "packages/apple/Package.swift",
      "openiap-versions.json",
      '".github/workflows/release-flutter.yml"',
      "apple-cocoapods:",
      "runs-on: macos-15",
      "XCODE_VERSION: 16.4",
      "maxim-lobanov/setup-xcode@v1",
      "xcode-version: ${{ env.XCODE_VERSION }}",
    ],
    "Flutter Apple dependency-manager trigger and toolchain coverage",
  );
  expectIncludes(
    ".github/workflows/release-flutter.yml",
    [
      "Build iOS CocoaPods consumer",
      "validate-apple-swiftpm",
      "needs: [validate-android, validate-ios, validate-apple-swiftpm]",
    ],
    "Flutter release Apple dependency-manager coverage",
  );
  expectNotIncludes(
    ".github/workflows/release-flutter.yml",
    [
      "Select CocoaPods fallback",
      "enable-swift-package-manager: false",
      "example/pubspec.yaml",
    ],
    "Flutter release must not mutate the tracked SwiftPM example into a CocoaPods consumer",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/example/pubspec.yaml",
    ["enable-swift-package-manager: true"],
    "Flutter example SwiftPM enablement",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/scripts/verify-ios-cocoapods-consumer-build.sh",
    [
      "XDG_CONFIG_HOME",
      "flutter config --no-enable-swift-package-manager",
      "flutter create",
      "ios/flutter_inapp_purchase.podspec",
      "minimum_ios_version=",
      '"flutter_inapp_purchase@{path: $package_root}"',
      "FlutterGeneratedPluginSwiftPackage|XCLocalSwiftPackageReference",
      "flutter build ios --simulator --debug --no-codesign",
      "flutter_inapp_purchase ",
      "openiap ",
    ],
    "Flutter CocoaPods consumer build isolation",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/scripts/verify-apple-swiftpm-consumer-build.sh",
    [
      'xcode_version_output="$(xcodebuild -version)"',
      "xcode_version=\"${xcode_version_output%%$'\\n'*}\"",
      '[[ "$xcode_version" != "Xcode 27"* ]]',
      "flutter build ios --config-only --simulator",
      "flutter build macos --config-only",
      "generic/platform=iOS Simulator",
      "generic/platform=macOS",
      "ARCHS=arm64",
      "ONLY_ACTIVE_ARCH=YES",
      "CODE_SIGNING_ALLOWED=NO",
    ],
    "Flutter Xcode 27 SwiftPM consumer build",
  );
  for (const podfilePath of [
    "libraries/flutter_inapp_purchase/example/ios/Podfile",
    "libraries/flutter_inapp_purchase/example/macos/Podfile",
  ]) {
    expectIncludes(
      podfilePath,
      [".flutter-plugins-dependencies", "swift_package_manager_enabled"],
      `${podfilePath} SwiftPM dependency-manager isolation`,
    );
  }
  expectIncludes(
    ".github/workflows/ci-maui-iap.yml",
    [
      "ios-binding:",
      "if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository",
      "runs-on: xcode-27",
    ],
    "MAUI Xcode 27 runner fork guard",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/example/ios/.gitignore",
    ["/Flutter/ephemeral/flutter_native_integration.env"],
    "Flutter Xcode 27 generated environment file must stay untracked",
  );
  for (const examplePath of [
    "libraries/react-native-iap/example/src/utils/buildPurchaseRows.ts",
    "libraries/expo-iap/example/src/utils/buildPurchaseRows.ts",
    "libraries/flutter_inapp_purchase/example/lib/src/widgets/purchase_detail_view.dart",
  ]) {
    expectIncludes(
      examplePath,
      [
        "bundleOriginalTransactionIdIOS",
        "bundleProductIdIOS",
        "bundleSubscriptionGroupIdIOS",
        "bundleTransactionIdIOS",
        "previousOriginalTransactionIdIOS",
        "revocationTypeIOS",
      ],
      "Xcode 27 purchase metadata example coverage",
    );
  }
  expectIncludes(
    "knowledge/external/storekit2-api.md",
    [
      "### Subscription Bundles and Suites (Xcode 27 beta)",
      "Test the catalog and transaction mappings with an Xcode 27 StoreKit",
      "revocationTypeIOS",
      "back-deployed `managed` acquisition platform",
      "it does not conflate",
      "OpenIAP must not invent a schema contract before Apple publishes one",
    ],
    "Xcode 27 support boundary",
  );
  expectNotIncludes(
    "packages/gql/src/type-ios.graphql",
    ["GroupPurchase", "groupPurchase", "seatCount"],
    "unpublished Group Purchase contract must stay out of the public schema",
  );
}

checkLibraryCoverageRegistry();
checkNativeSpecVersionFloor();
checkDeprecationSchedule();
checkNoOutboundWebhookStream();
checkExpoSsotRegistry();
checkE2eExampleIds();
checkGeneratedTypeSync();
for (const issue of collectPurchasePayloadParityFailures(root)) {
  fail(issue);
}
checkGqlRuntimeExports();
checkOperationRegistry();
checkGoogleFlavorHandlerWiring();
checkFrameworkOperationBindings();
checkExpoRouterExample("libraries/expo-iap/example", "src/utils/constants.ts");
checkReactNativeClassic();
checkFlutter();
checkKmp();
checkApple();
checkGoogle();
checkMaui();
checkNativeApis();
checkBillingChoiceFieldBindings();
checkFrameworkCiAndCoverageBadges();
checkFrameworkDependencyHygiene();
checkReleaseNoteGroupingGuidance();
checkXcode27StoreKitCoverage();
expectNoExampleStorefrontIOS();
expectNoApi24ConcurrentKeySets();

if (failures.length > 0) {
  console.error(
    `Non-Godot parity audit failed with ${failures.length} issue(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Non-Godot example/API/test parity audit passed.");
