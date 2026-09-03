#!/usr/bin/env node

// Guards the path filters that gate native builds and Swift CodeQL.
// Filters are read from the workflows themselves, so there is no second copy.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

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
  android: ["ci:test-android"],
  docs: ["ci:test-docs"],
  gql: ["ci:test-gql"],
  ios: ["ci:test-ios", "ci:test-ios-compiler-boundaries"],
  web: ["ci:web-e2e"],
});

export const unconditionalCiJobs = Object.freeze([
  "audit-lockfile",
  "audit-parity",
  "audit-release-state",
  "changes",
  "test-agent",
  "test-conformance",
  "test-commerce-protocol",
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

// The audited vocabulary is exactly three forms, so ordered (GitHub native)
// and polarity-based (dorny some-with-excludes) evaluation coincide.
export function matchesPattern(pattern, file) {
  if (pattern === "**/*.md") {
    return file.endsWith(".md");
  }

  if (pattern.endsWith("/**")) {
    return file.startsWith(pattern.slice(0, -2));
  }

  return file === pattern;
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
    name: "apple-core-docs-only",
    files: [
      "packages/apple/README.md",
      "packages/apple/CONVENTION.md",
      "packages/apple/CONTRIBUTING.md",
    ],
    jobs: [],
  },
  {
    name: "apple-core-source",
    files: ["packages/apple/Sources/OpenIapModule.swift"],
    jobs: [
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
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
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
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
    jobs: ["ci-kmp-iap.yml", "codeql:analyze-swift"],
  },
  {
    name: "kmp-docs-only",
    files: [
      "libraries/kmp-iap/AGENTS.md",
      "libraries/kmp-iap/CLAUDE.md",
      "libraries/kmp-iap/.vscode/README_IOS_DEVICE.md",
    ],
    jobs: [],
  },
  {
    name: "kmp-vscode-launch-script",
    files: ["libraries/kmp-iap/.vscode/run_ios.sh"],
    jobs: ["ci-kmp-iap.yml"],
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
    jobs: [],
  },
  {
    name: "react-native-swift-source",
    files: ["libraries/react-native-iap/ios/HybridRnIap.swift"],
    jobs: [
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
    jobs: [],
  },
  {
    name: "expo-swift-source",
    files: ["libraries/expo-iap/ios/ExpoIapModule.swift"],
    jobs: [
      "ci-expo-iap.yml",
      "codeql:analyze-swift-wrappers/expo",
      "codeql:analyze-swift-wrappers/expo-onside",
    ],
  },
  {
    name: "expo-onside-swift-source",
    files: ["libraries/expo-iap/ios/onside/OnsideIapModule.swift"],
    jobs: [
      "ci-expo-iap.yml",
      "codeql:analyze-swift-wrappers/expo",
      "codeql:analyze-swift-wrappers/expo-onside",
    ],
  },
  {
    name: "expo-onside-podfile-plugin",
    files: ["libraries/expo-iap/plugin/src/onsidePodfile.ts"],
    jobs: [
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
    jobs: [],
  },
  {
    name: "flutter-build-script",
    files: [
      "libraries/flutter_inapp_purchase/scripts/verify-apple-swiftpm-consumer-build.sh",
    ],
    jobs: [
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
    jobs: [],
  },
  {
    name: "godot-swift-source",
    files: [
      "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift",
    ],
    jobs: ["ci-godot-iap.yml", "codeql:analyze-swift-wrappers/godot"],
  },
  {
    name: "godot-addon-behind-symlink",
    files: ["libraries/godot-iap/addons/godot-iap/godot_iap.gd"],
    jobs: ["ci-godot-iap.yml", "codeql:analyze-swift-wrappers/godot"],
  },
  {
    name: "google-docs-only",
    files: [
      "packages/google/README.md",
      "packages/google/ALTERNATIVE_BILLING.md",
    ],
    jobs: [],
  },
  {
    name: "google-source",
    files: ["packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt"],
    jobs: ["ci-kmp-iap.yml", "ci-maui-iap.yml", "ci:test-android"],
  },
  {
    name: "root-version-manifest",
    files: ["openiap-versions.json"],
    jobs: [
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
    name: "libraries-versions-manifest",
    files: ["libraries-versions.jsonc"],
    jobs: [
      "ci-expo-iap.yml",
      "ci-flutter-inapp-purchase.yml",
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
    jobs: ["codeql:analyze-swift", ...ALL_SWIFT_WRAPPERS],
  },
  {
    name: "maui-binding-source",
    files: ["libraries/maui-iap/src/OpenIap.Maui/Types.cs"],
    jobs: ["ci-maui-iap.yml", "ci:test-gql"],
  },
  {
    // kit ships .md as bundled site content, so `web` keeps every markdown path.
    name: "kit-content-markdown",
    files: ["packages/kit/src/content/privacy-policy.md"],
    jobs: ["ci:web-e2e"],
  },
  {
    name: "docs-site-source",
    files: ["packages/docs/src/pages/docs/index.tsx"],
    jobs: ["ci:test-docs", "ci:web-e2e"],
  },
  {
    name: "commerce-protocol-source",
    files: ["specs/commerce-protocol/schema/05-operations.graphql"],
    // The kit server embeds the generated protocol artifacts at build time,
    // so a contract change also rebuilds and probes the web binary.
    jobs: ["ci:test-docs", "ci:web-e2e"],
  },
  {
    // docs and web intentionally keep markdown; both are cheap ubuntu jobs.
    name: "docs-markdown",
    files: ["packages/docs/README.md"],
    jobs: ["ci:test-docs", "ci:web-e2e"],
  },
  {
    name: "scripts-docs-only",
    files: ["scripts/agent/README.md"],
    jobs: [],
  },
  {
    name: "mixed-docs-and-source",
    files: [
      "libraries/expo-iap/README.md",
      "libraries/godot-iap/ios-gdextension/Sources/GodotIap/Binder.swift",
    ],
    jobs: ["ci-godot-iap.yml", "codeql:analyze-swift-wrappers/godot"],
  },
  {
    name: "mixed-two-wrappers",
    files: [
      "libraries/expo-iap/ios/ExpoIapLog.swift",
      "libraries/godot-iap/ios-gdextension/Package.swift",
    ],
    jobs: [
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
    jobs: [],
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

      if (body !== "**/*.md" && /[*?+[\]{}]/u.test(literal)) {
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

/**
 * Docs link to the canonical Commerce Protocol and R15 checks its derived
 * transport constants, so every protocol change must run the docs job.
 */
function findDocsFilterViolations(root) {
  const ci = readWorkflow(root, "ci.yml");
  const { filters } = dornyStep(ci, "changes", "filter");
  const docs = filters?.docs ?? [];
  const required = ["specs/commerce-protocol/**"];
  return required
    .filter((pattern) => !docs.includes(pattern))
    .map(
      (pattern) =>
        `ci.yml: docs filter must include '${pattern}' — the canonical contract and its generated artifacts govern docs`,
    );
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

    if (
      name in ciFilters &&
      ci.jobs.changes.outputs[name] !== `\${{ steps.filter.outputs.${name} }}`
    ) {
      findings.push(
        `ci.yml: changes job must publish the ${name} filter output`,
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
    ...findDocsFilterViolations(root),
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
