import assert from "node:assert/strict";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  BUN_AUDIT_ATTEMPTS,
  auditDependencies,
  auditWorkflowFiles,
  extractExternalUrls,
  findActionFamilyDrift,
  findUnpinnedDockerBases,
  findWorkflowDependencyFindings,
  findWorkflowRunInterpolations,
  isTransportFailure,
  listWorkflowFiles,
  parseBunAuditOutput,
  parseOsvIgnoredVulnerabilities,
  runBunAudit,
  summarizeAdvisories,
} from "./audit-security.mjs";

test("workflow scan detects expressions in scalar and block run steps", () => {
  const workflow = `steps:
  - run: echo "${"${{"} inputs.scalar }}"
  - name: Block
    run: |
      echo "safe"
      echo "${"${{"} github.event.issue.title }}"
  - uses: actions/checkout@v7
`;
  assert.deepEqual(findWorkflowRunInterpolations(workflow, "fixture.yml"), [
    'fixture.yml:2: - run: echo "${{ inputs.scalar }}"',
    'fixture.yml:6: echo "${{ github.event.issue.title }}"',
  ]);
});

test("workflow scan recognizes YAML block-scalar header variants", () => {
  for (const header of ["|2", ">-2", "|2-", ">+2", "| # note", "|2 # note"]) {
    const workflow = `steps:\n  - run: ${header}\n      echo "${"${{"} inputs.value }}"\n`;
    assert.deepEqual(findWorkflowRunInterpolations(workflow, "fixture.yml"), [
      'fixture.yml:3: echo "${{ inputs.value }}"',
    ]);
  }
});

test("workflow scan rejects quoted, spaced, and flow-map run keys", () => {
  const workflow = `jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - "run": echo "${"${{"} inputs.quoted }}"
      - { run: 'echo "${"${{"} inputs.flow }}"' }
      - run : echo "${"${{"} inputs.spaced }}"
`;
  assert.equal(findWorkflowRunInterpolations(workflow).length, 3);
});

test("workflow scan resolves aliased run keys and values", () => {
  const workflow = `x-shell: &shell 'echo "${"${{"} inputs.value }}"'
x-key: &key run
steps:
  - run: *shell
  - ? *key
    : 'echo "${"${{"} github.event.issue.title }}"'
`;
  assert.equal(findWorkflowRunInterpolations(workflow).length, 2);
});

test("workflow dependency scan requires least privilege and immutable actions", () => {
  const pinned = `permissions:\n  contents: read\nsteps:\n  - uses: actions/checkout@${"a".repeat(40)} # v7\n`;
  assert.deepEqual(findWorkflowDependencyFindings(pinned), []);
  assert.deepEqual(
    findWorkflowDependencyFindings(
      "steps:\n  - uses: actions/checkout@v7\n  - uses: ./local-action\n",
      "fixture.yml",
    ),
    [
      "fixture.yml: missing top-level permissions",
      "fixture.yml:2: unpinned action actions/checkout@v7",
    ],
  );
  assert.deepEqual(
    findWorkflowDependencyFindings(
      `permissions: read-all
jobs:
  test:
    steps:
      - uses: Actions/Checkout@${"e".repeat(40)} # v7
`,
      "fixture.yml",
    ),
    ["fixture.yml: job test checkout must disable persisted credentials"],
  );
  assert.deepEqual(
    findWorkflowDependencyFindings(
      `permissions: read-all\nsteps:\n  - uses: actions/checkout@${"b".repeat(40)}\n`,
      "fixture.yml",
    ),
    ["fixture.yml:3: pinned action is missing a version comment"],
  );
  assert.deepEqual(
    findWorkflowDependencyFindings(
      `permissions:\n  contents: write\nsteps:\n  - uses: actions/checkout@${"c".repeat(40)} # v7\n`,
      "fixture.yml",
    ),
    ["fixture.yml: top-level permissions must be read-only"],
  );
  for (const permissions of [
    "permissions: write-all # release",
    "permissions: { contents: write }",
    'permissions:\n  contents: "write"',
  ]) {
    assert.deepEqual(
      findWorkflowDependencyFindings(
        `${permissions}\nsteps:\n  - uses: actions/checkout@${"d".repeat(40)} # v7\n`,
        "fixture.yml",
      ),
      ["fixture.yml: top-level permissions must be read-only"],
    );
  }
  assert.deepEqual(
    findWorkflowDependencyFindings(
      `permissions: read-all
jobs:
  release:
    permissions: write-all
    steps: []
`,
      "fixture.yml",
    ),
    ["fixture.yml: job release must not use write-all"],
  );
  assert.deepEqual(
    findWorkflowDependencyFindings(
      `permissions: read-all
jobs:
  release:
    permissions:
      contents: write
      id-token: write
    steps: []
`,
      "fixture.yml",
    ),
    [],
  );
  assert.deepEqual(
    findWorkflowDependencyFindings(
      `permissions: read-all
steps:
  - "uses": actions/checkout@v7
  - { uses: actions/setup-node@v6 }
`,
      "fixture.yml",
    ),
    [
      "fixture.yml:3: unpinned action actions/checkout@v7",
      "fixture.yml:4: unpinned action actions/setup-node@v6",
    ],
  );
  assert.deepEqual(
    findWorkflowDependencyFindings(
      `permissions: read-all
env:
  ACTION: &action actions/checkout@v7
steps:
  - uses: *action
`,
      "fixture.yml",
    ),
    ["fixture.yml:5: unpinned action actions/checkout@v7"],
  );
});

test("workflow discovery covers both YAML extensions", (t) => {
  const scratch = mkdtempSync(resolve(tmpdir(), "openiap-workflows-"));
  writeFileSync(resolve(scratch, "first.yml"), "permissions: read-all\n");
  writeFileSync(resolve(scratch, "second.yaml"), "permissions: read-all\n");
  writeFileSync(resolve(scratch, "ignored.txt"), "permissions: write-all\n");
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  assert.deepEqual(listWorkflowFiles(scratch, "fixtures"), [
    "fixtures/first.yml",
    "fixtures/second.yaml",
  ]);
  const ci = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  assert.match(ci, /node scripts\/audit-security\.mjs workflows\s*$/mu);
  assert.doesNotMatch(ci, /workflows .*\.yml/u);
});

test("Dependabot lock refresh isolates write credentials from installs", () => {
  const source = readFileSync(
    new URL(
      "../.github/workflows/dependabot-bun-lockfile.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const refreshStart = source.indexOf("  refresh:");
  const retriggerStart = source.indexOf("  retrigger:");
  assert.ok(refreshStart >= 0);
  assert.ok(retriggerStart > refreshStart);
  const refresh = source.slice(refreshStart, retriggerStart);
  const installStart = refresh.indexOf("      - name: Run bun install");
  const pushStart = refresh.indexOf(
    "      - name: Commit and push refreshed lockfile",
  );
  assert.ok(installStart >= 0);
  assert.ok(pushStart > installStart);
  const install = refresh.slice(installStart, pushStart);

  assert.match(refresh, /persist-credentials: false/u);
  assert.match(
    refresh,
    /github\.event\.pull_request\.user\.login == 'dependabot\[bot\]'/u,
  );
  assert.doesNotMatch(refresh, /github\.actor/u);
  assert.match(install, /bun install --ignore-scripts/u);
  assert.doesNotMatch(install, /GH_TOKEN|GITHUB_TOKEN|contents: write/u);
  assert.doesNotMatch(refresh, /actions: write/u);
  assert.match(source.slice(source.indexOf("  retrigger:")), /actions: write/u);
});

test("URL extraction removes JSX and Markdown delimiters", () => {
  const source =
    `href='https://example.com/path' [docs](https://example.org/a). ` +
    `https://example.net/releases/<version>`;
  assert.deepEqual(extractExternalUrls(source), [
    "https://example.com/path",
    "https://example.org/a",
  ]);
});

test("workflow scans pass when interpolation and permission findings are absent", async (t) => {
  const scratch = mkdtempSync(resolve(tmpdir(), "openiap-security-audit-"));
  const workflow = resolve(scratch, "empty.yml");
  writeFileSync(
    workflow,
    "permissions: read-all\nsteps:\n  - run: echo safe\n",
  );
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  assert.deepEqual(
    findWorkflowRunInterpolations("steps:\n  - run: echo safe\n"),
    [],
  );
  await assert.doesNotReject(() => auditWorkflowFiles([workflow]));
});

test("workflow scans fail on direct run interpolation", async (t) => {
  const scratch = mkdtempSync(resolve(tmpdir(), "openiap-security-audit-"));
  const workflow = resolve(scratch, "unsafe.yml");
  writeFileSync(
    workflow,
    `permissions: read-all\nsteps:\n  - run: echo "${"${{"} inputs.value }}"\n`,
  );
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  await assert.rejects(() => auditWorkflowFiles([workflow]), /inputs\.value/u);
});

test("empty URL extraction is explicit", () => {
  assert.deepEqual(extractExternalUrls("no links"), []);
});

test("bun audit parsing tolerates the CLI banner", () => {
  const audit = parseBunAuditOutput(
    '\u001b[1mbun audit\u001b[0m v1.3.13\n{"hono":[{"severity":"high","title":"example"}]}\n',
  );
  assert.deepEqual(summarizeAdvisories(audit), [
    {
      id: undefined,
      packageName: "hono",
      severity: "high",
      title: "example",
    },
  ]);
});

test("dependency audit fails closed on findings and malformed output", () => {
  const projects = [{ directory: ".", lockfile: "bun.lock" }];
  assert.throws(
    () =>
      auditDependencies(
        () => ({
          status: 1,
          stdout:
            '{"hono":[{"severity":"high","title":"unsafe version","url":"https://github.com/advisories/GHSA-test-test-test"}]}',
          stderr: "",
        }),
        projects,
      ),
    /1 dependency audit findings/u,
  );
  assert.throws(
    () =>
      auditDependencies(
        () => ({ status: 1, stdout: "", stderr: "network failed" }),
        projects,
      ),
    /no JSON result/u,
  );
  assert.throws(
    () =>
      auditDependencies(
        () => ({
          status: 2,
          stdout:
            '{"image-size":[{"severity":"high","title":"partial","url":"https://github.com/advisories/GHSA-test-test-test"}]}',
          stderr: "network failed after partial output",
        }),
        projects,
      ),
    /bun audit exited 2/u,
  );
});

test("dependency exceptions require a reason and expiry", () => {
  assert.deepEqual(
    parseOsvIgnoredVulnerabilities(`[[IgnoredVulns]]
id = "GHSA-test-test-test"
ignoreUntil = 2026-09-14
reason = "No patched release exists."
`),
    new Map([
      [
        "GHSA-test-test-test",
        {
          ignoreUntil: "2026-09-14",
          reason: "No patched release exists.",
        },
      ],
    ]),
  );
  assert.throws(
    () => parseOsvIgnoredVulnerabilities('[[IgnoredVulns]]\nid = "GHSA-x"'),
    /needs id, ignoreUntil, and reason/u,
  );
  assert.throws(
    () =>
      parseOsvIgnoredVulnerabilities(`[[IgnoredVulns]]
id = "GHSA-x"
ignoreUntil = 2026-02-30
reason = "Invalid date."
`),
    /invalid ignored vulnerability expiry/u,
  );
});

test("Yarn-only OSV exceptions cannot become stale or expired", () => {
  const yarnLock = "libraries/react-native-iap/yarn.lock";
  const activeReport = JSON.stringify({
    results: [
      {
        packages: [
          {
            vulnerabilities: [
              { id: "GHSA-5p2g-fcmc-qvqq" },
              { id: "GHSA-w3rx-r6r6-pgpr" },
              { id: "GHSA-vcc3-ghjq-m6fr" },
            ],
          },
        ],
      },
    ],
  });
  const scanner = (command, args) => {
    assert.equal(command, "osv-scanner");
    assert.ok(args.includes(`--lockfile=${yarnLock}`));
    assert.ok(args.includes("--config=/dev/null"));
    return { status: 1, stdout: activeReport, stderr: "" };
  };

  assert.doesNotThrow(() =>
    auditDependencies(scanner, [], new Date("2026-08-15T00:00:00Z"), [
      yarnLock,
    ]),
  );
  assert.throws(
    () =>
      auditDependencies(
        () => ({
          status: 0,
          stdout: JSON.stringify({ results: [] }),
          stderr: "",
        }),
        [],
        new Date("2026-08-15T00:00:00Z"),
        [yarnLock],
      ),
    /unused dependency exception/u,
  );
  assert.throws(
    () =>
      auditDependencies(scanner, [], new Date("2026-09-15T00:00:00Z"), [
        yarnLock,
      ]),
    /expired dependency exception/u,
  );
  const unaccepted = JSON.parse(activeReport);
  unaccepted.results[0].packages[0].vulnerabilities.push({
    id: "GHSA-new-unaccepted-test",
    summary: "new Yarn advisory",
  });
  assert.throws(
    () =>
      auditDependencies(
        () => ({ status: 1, stdout: JSON.stringify(unaccepted), stderr: "" }),
        [],
        new Date("2026-08-15T00:00:00Z"),
        [yarnLock],
      ),
    /GHSA-new-unaccepted-test/u,
  );
});

test("OSV scans non-Bun locks without exception files", () => {
  const gemLock = "libraries/react-native-iap/example/Gemfile.lock";
  let calls = 0;
  const cleanScanner = (command, args) => {
    calls += 1;
    assert.equal(command, "osv-scanner");
    assert.ok(args.includes(`--lockfile=${gemLock}`));
    return {
      status: 0,
      stdout: JSON.stringify({ results: [] }),
      stderr: "",
    };
  };
  assert.doesNotThrow(() =>
    auditDependencies(cleanScanner, [], new Date("2026-08-15T00:00:00Z"), [
      gemLock,
    ]),
  );
  assert.equal(calls, 1);

  assert.throws(
    () =>
      auditDependencies(
        () => ({
          status: 1,
          stdout: JSON.stringify({ results: [] }),
          stderr: "partial scan failure",
        }),
        [],
        new Date("2026-08-15T00:00:00Z"),
        [gemLock],
      ),
    /exited 1 without findings/u,
  );
  assert.throws(
    () =>
      auditDependencies(
        () => ({
          status: 0,
          stdout: JSON.stringify({ results: {} }),
          stderr: "",
        }),
        [],
        new Date("2026-08-15T00:00:00Z"),
        [gemLock],
      ),
    /invalid OSV-Scanner result structure/u,
  );

  assert.throws(
    () =>
      auditDependencies(
        () => ({
          status: 1,
          stdout: JSON.stringify({
            results: [
              {
                packages: [
                  {
                    vulnerabilities: [
                      { id: "GHSA-new-ruby-advisory", summary: "Ruby issue" },
                    ],
                  },
                ],
              },
            ],
          }),
          stderr: "",
        }),
        [],
        new Date("2026-08-15T00:00:00Z"),
        [gemLock],
      ),
    /GHSA-new-ruby-advisory/u,
  );
});

test("published SBOM audit fails fast and trusts only main", () => {
  const source = readFileSync(
    new URL("../.claude/commands/audit-security.md", import.meta.url),
    "utf8",
  );
  const block = source.match(
    /## 7\. Published release assets[\s\S]*?```bash\n([\s\S]*?)```/u,
  )?.[1];

  assert.ok(block, "published asset audit command is missing");
  assert.match(block, /^set -euo pipefail$/mu);
  assert.match(block, /@refs\/heads\/main/u);
  assert.match(block, /--cert-identity "\$cert_identity"/u);
  assert.match(block, /--deny-self-hosted-runners --format json/u);
  assert.match(block, /verify-attested-generator/u);
  assert.match(block, /--event schedule/u);
  assert.match(block, /9 \* 24 \* 60 \* 60 \* 1000/u);
  assert.match(block, /ASSESSED_MAIN_SHA=\$\(git rev-parse origin\/main\)/u);
  assert.match(block, /--commit "\$ASSESSED_MAIN_SHA"/u);
  assert.match(
    block,
    /\.event == "schedule" or \.event == "workflow_dispatch"/u,
  );
  assert.match(block, /\.headSha == \$sha/u);
  assert.doesNotMatch(block, /--signer-workflow/u);
});

test("sbom.yml restores every module the generator imports", () => {
  // sbom.yml runs the current generator against a released tag's tree, so it
  // copies the generator files in by name. A new module reachable from the
  // entry point but missing from that list fails with ERR_MODULE_NOT_FOUND
  // before any SBOM is produced — for every tag that predates the file.
  const workflow = readFileSync(
    new URL("../.github/workflows/sbom.yml", import.meta.url),
    "utf8",
  );
  const listed = new Set(
    [...workflow.matchAll(/^\s*(scripts\/[\w.-]+\.mjs)\s*\\?$/gmu)].map(
      (match) => match[1],
    ),
  );
  assert.ok(listed.size > 0, "no generator files found in sbom.yml");

  const scripts = new URL("../scripts/", import.meta.url);
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const source = readFileSync(new URL(name, scripts), "utf8");
    // Every local-module form: `from "./x"`, a bare `import "./x"`, and a
    // dynamic `import("./x")`, in either quote style. Recognising only the
    // first would let a new module go unrestored.
    for (const match of source.matchAll(
      /(?:from\s*|\bimport\s*\(?\s*)['"]\.\/([\w.-]+\.mjs)['"]/gu,
    )) {
      visit(match[1]);
    }
  };
  visit("generate-sbom.mjs");

  const missing = [...seen]
    .map((name) => `scripts/${name}`)
    .filter((path) => !listed.has(path));
  assert.deepEqual(
    missing,
    [],
    `sbom.yml does not restore: ${missing.join(", ")}`,
  );
});

test("the KMP Swift bridge stays a re-export CodeQL need not analyse", () => {
  // codeql.yml builds this package AFTER `analyze`, so its sources are never
  // in the database. That is correct only while the package re-exports a
  // released module and defines nothing itself; real logic added here would
  // ship without Swift analysis and nothing else would notice.
  // The scanned directory comes from Package.swift, not a fixed path: a target
  // pointed elsewhere would otherwise leave stale import-only files here and
  // ship real Swift with no analysis.
  const packageRoot = new URL(
    "../libraries/kmp-iap/native/InAppPurchaseBridge/",
    import.meta.url,
  );
  const manifest = readFileSync(new URL("Package.swift", packageRoot), "utf8");
  assert.doesNotMatch(
    manifest,
    /\bpath\s*:/u,
    "Package.swift sets an explicit target path; point this guard at it",
  );
  const root = new URL("Sources/", packageRoot);
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(new URL(`${entry.name}/`, dir))
        : [new URL(entry.name, dir)],
    );

  const sources = walk(root);
  assert.ok(sources.length > 0, "the bridge has no sources");
  for (const source of sources) {
    // SwiftPM builds C, Objective-C and C++ sources in the same target without
    // an explicit path, and CodeQL never sees them because this package is
    // built after `analyze`.
    assert.match(
      source.pathname,
      /\.swift$/u,
      `${source.pathname} is compiled but not analysed: move it, or build this package between init and analyze`,
    );
    for (const line of readFileSync(source, "utf8").split("\n")) {
      const code = line.trim();
      if (code === "" || code.startsWith("//")) continue;
      assert.match(
        code,
        /^(?:@_exported\s+)?import\s+\w+$/u,
        `${source.pathname} defines code, so it needs CodeQL coverage: move it, or build this package between init and analyze`,
      );
    }
  }
});

test("the manual audit runs every gate the scheduled rescan runs", () => {
  // The manual procedure and security-rescan.yml are two copies of the same
  // audit. When a gate was added to the workflow alone, the documented audit
  // reported success on a state CI rejects. Derive the expectation from the
  // workflow so a future gate cannot be added to only one of them.
  // A commented-out command is not a gate. Without this the documented audit
  // could satisfy the comparison while running nothing.
  const withoutComments = (text) =>
    text
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n")
      // A command wrapped with a trailing backslash puts the subcommand on the
      // next line, where the pattern below would not see it.
      .replace(/\s*\\\n\s*/gu, " ");
  const subcommands = (text) =>
    new Set(
      [...withoutComments(text).matchAll(/generate-sbom\.mjs ([a-z-]+)/gu)].map(
        (match) => match[1],
      ),
    );

  const workflow = readFileSync(
    new URL("../.github/workflows/security-rescan.yml", import.meta.url),
    "utf8",
  );
  const doc = readFileSync(
    new URL("../.claude/commands/audit-security.md", import.meta.url),
    "utf8",
  );
  const block = doc.match(
    /## 7\. Published release assets[\s\S]*?```bash\n([\s\S]*?)```/u,
  )?.[1];
  assert.ok(block, "published asset audit command is missing");

  const expected = subcommands(workflow);
  assert.ok(expected.size > 0, "no gates found in security-rescan.yml");
  const documented = subcommands(block);
  const missing = [...expected].filter((name) => !documented.has(name));
  assert.deepEqual(
    missing,
    [],
    `documented audit omits gates the rescan runs: ${missing.join(", ")}`,
  );
});

test("manual SBOM audits fail closed on partial or incomplete inventories", () => {
  const source = readFileSync(
    new URL("../.claude/commands/audit-security.md", import.meta.url),
    "utf8",
  );
  const schemaBlock = source.match(
    /## 3\. Schema validity[\s\S]*?```bash\n([\s\S]*?)```/u,
  )?.[1];
  const ntiaBlock = source.match(
    /## 4\. NTIA minimum elements[\s\S]*?```bash\n([\s\S]*?)```/u,
  )?.[1];
  const leakBlock = source.match(
    /## 5\. No leaked paths or secrets[\s\S]*?```bash\n([\s\S]*?)```/u,
  )?.[1];
  const gitBlock = source.match(
    /## 9\. Generated SBOMs stay out of git[\s\S]*?```bash\n([\s\S]*?)```/u,
  )?.[1];
  const docsBlock = source.match(
    /## 10\. Documentation matches the code[\s\S]*?```bash\n([\s\S]*?)```/u,
  )?.[1];

  assert.ok(schemaBlock, "schema audit command is missing");
  assert.ok(ntiaBlock, "NTIA audit command is missing");
  assert.ok(leakBlock, "path and secret audit command is missing");
  assert.ok(gitBlock, "generated-file audit command is missing");
  assert.ok(docsBlock, "documentation audit command is missing");
  assert.match(schemaBlock, /^set -euo pipefail$/mu);
  assert.match(ntiaBlock, /^set -euo pipefail$/mu);
  assert.match(ntiaBlock, /missing author name/u);
  assert.match(ntiaBlock, /missing root supplier/u);
  assert.match(ntiaBlock, /generated \$\{files\}\/\$\{expectedFiles\}/u);
  assert.match(leakBlock, /echo "LEAK"\s+exit 1/u);
  assert.match(gitBlock, /GAP: sbom\/ is committable[\s\S]*?exit 1/u);
  assert.match(gitBlock, /GAP: generated SBOMs are tracked[\s\S]*?exit 1/u);
  assert.match(docsBlock, /if \(missing\) process\.exitCode = 1/u);
});

test("compiled CodeQL Gradle builds reuse the transient-network retry guard", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/codeql.yml", import.meta.url),
    "utf8",
  );
  assert.equal(
    (workflow.match(/scripts\/ci\/retry-gradle\.sh/gu) ?? []).length,
    6,
  );
  assert.match(workflow, /:openiap:compilePlayDebugKotlin/u);
  assert.match(workflow, /:library:compilePlayDebugKotlinAndroid/u);
});

test("CodeQL scopes Swift pull requests to public macOS runners", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/codeql.yml", import.meta.url),
    "utf8",
  );
  const scope = workflow.slice(
    workflow.indexOf("  codeql-scope:"),
    workflow.indexOf("  analyze:"),
  );
  const wrappers = workflow.slice(
    workflow.indexOf("  analyze-swift-wrappers:"),
  );
  const swiftCore = workflow.slice(
    workflow.indexOf("  analyze-swift:"),
    workflow.indexOf("  analyze-swift-wrappers:"),
  );
  assert.match(
    workflow,
    /group: codeql-\$\{\{ github\.event\.pull_request\.number \|\| github\.run_id \}\}/u,
  );
  assert.match(
    workflow,
    /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/u,
  );
  assert.match(scope, /swift_core:/u);
  assert.match(swiftCore, /needs: \[codeql-scope, pick-mac-runner\]/u);
  assert.match(
    swiftCore,
    /if: needs\.codeql-scope\.outputs\.swift_core == 'true'/u,
  );
  assert.match(
    swiftCore,
    /runs-on: \$\{\{ needs\.pick-mac-runner\.outputs\.runner \}\}/u,
  );
  // The gate may hand a job to the self-hosted Mac only for the owner's own
  // pull requests, and it always falls back to the hosted image.
  const gate = workflow.slice(
    workflow.indexOf("  pick-mac-runner:"),
    workflow.indexOf("  analyze-swift:"),
  );
  assert.match(
    gate,
    /github\.event\.pull_request\.user\.login == 'hyochan' && github\.actor == 'hyochan'/u,
  );
  assert.match(gate, /github\.event_name == 'pull_request'/u);
  assert.match(gate, /runner='macos-26'/u);
  assert.match(gate, /-lt 900/u);
  assert.match(scope, /react-native:/u);
  assert.match(scope, /expo-onside:/u);
  assert.match(scope, /flutter:/u);
  assert.match(scope, /godot:/u);
  assert.match(
    scope,
    /\["react-native","expo","expo-onside","flutter","godot"\]/u,
  );
  assert.match(
    wrappers,
    /needs\.codeql-scope\.outputs\.swift_wrappers == 'true'/u,
  );
  assert.match(
    wrappers,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/u,
  );
  // Pushes keep the xcode-27 split; PR legs stay hosted except godot, which
  // may ride the owner-gated Mac.
  assert.match(
    wrappers,
    /github\.event_name != 'pull_request'\s+&& \(matrix\.component == 'godot' && 'macos-26' \|\| 'xcode-27'\)/u,
  );
  assert.match(wrappers, /\|\| needs\.pick-mac-runner\.outputs\.runner \}\}/u);
  assert.match(
    wrappers,
    /EXPECTED_XCODE_MAJOR: \$\{\{ github\.event_name == 'pull_request' && '26' \|\| '27' \}\}/u,
  );
  assert.match(
    wrappers,
    /component: \$\{\{ fromJSON\(needs\.codeql-scope\.outputs\.swift_components\) \}\}/u,
  );
  assert.match(
    wrappers,
    /EXPO_IAP_ONSIDE: \$\{\{ matrix\.component == 'expo-onside' && '1' \|\| '0' \}\}/u,
  );
});

test("Kit installs security tools from the workspace root", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/deploy-kit.yml", import.meta.url),
    "utf8",
  );
  const installStep = workflow.match(
    /- name: Install OSV-Scanner v2\.5\.0[\s\S]*?(?=\n\s+- name:)/u,
  )?.[0];
  assert.ok(installStep);
  assert.match(
    installStep,
    /working-directory: \$\{\{ github\.workspace \}\}/u,
  );
  assert.match(installStep, /scripts\/install-security-tool\.sh osv-scanner/u);
});

test("Kit Docker base images are digest pinned", () => {
  const dockerfile = readFileSync(
    new URL("../packages/kit/Dockerfile", import.meta.url),
    "utf8",
  );
  assert.deepEqual(findUnpinnedDockerBases(dockerfile), []);
  assert.deepEqual(
    findUnpinnedDockerBases(`FROM example:latest AS base
FROM base AS build
FROM alpine:latest AS runtime
`),
    ["example:latest", "alpine:latest"],
  );
  assert.deepEqual(
    findUnpinnedDockerBases(`FROM example:1@sha256:${"a".repeat(64)} AS base
FROM base AS runtime
`),
    [],
  );
  assert.deepEqual(
    findUnpinnedDockerBases(
      "FROM --platform=$BUILDPLATFORM alpine:latest AS helper # build image\n",
    ),
    ["alpine:latest"],
  );
});

test("a transport failure is retried, a verdict is not", () => {
  // bun audit reaches a remote advisory service; that call fails
  // intermittently and blocked this repository's CI three times. Only the
  // transport error repeats — a real advisory must still fail the audit.
  let transient = 0;
  const flaky = () => {
    transient += 1;
    return transient < 3
      ? {
          status: 1,
          stdout: "",
          stderr: "ConnectionClosed: audit request failed",
        }
      : { status: 0, stdout: '{"advisories":{}}', stderr: "" };
  };
  const recovered = runBunAudit(flaky, "/tmp", { sleep: () => {} });
  assert.equal(transient, 3);
  assert.ok(BUN_AUDIT_ATTEMPTS >= 3, "too few attempts to ride out a blip");
  assert.equal(recovered.stdout, '{"advisories":{}}');

  let verdicts = 0;
  const advisory = () => {
    verdicts += 1;
    return { status: 1, stdout: '{"advisories":{"pkg":[]}}', stderr: "" };
  };
  runBunAudit(advisory, "/tmp", { sleep: () => {} });
  assert.equal(verdicts, 1, "a verdict must not be retried");
});

test("the healthy path never sleeps", () => {
  // The backoff only costs time when the service is actually failing.
  const slept = [];
  runBunAudit(() => ({ status: 0, stdout: "{}", stderr: "" }), "/tmp", {
    sleep: (ms) => slept.push(ms),
  });
  assert.deepEqual(slept, []);
});

test("a persistent transport failure still fails after its attempts", () => {
  let calls = 0;
  const down = () => {
    calls += 1;
    return { status: 1, stdout: "", stderr: "Timeout: audit request failed" };
  };
  const result = runBunAudit(down, "/tmp", { sleep: () => {} });
  assert.equal(calls, BUN_AUDIT_ATTEMPTS);
  assert.ok(isTransportFailure(result), "the transport failure must survive");
});

test("transport detection does not swallow an ordinary failure", () => {
  assert.equal(
    isTransportFailure({ stdout: "", stderr: "bun: command not found" }),
    false,
  );
  assert.equal(isTransportFailure({ stdout: "", stderr: "" }), false);
});

test("actions from one repository must be pinned to one commit", () => {
  const OLD = "db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28";
  const NEW = "cdf488f595d80d6e07e03d4674febd5ab45fa938";
  const uses = (path, sha) => `      - uses: ${path}@${sha} # v4\n`;

  // The real failure this prevents: Dependabot bumped codeql-action/init on
  // its own, and every Analyze job died with "Loaded a configuration file for
  // version 4.37.9, but running version 4.37.8". Grouping in dependabot.yml
  // stops it arriving split; this catches it if it arrives split anyway.
  const drifted = findActionFamilyDrift([
    ["codeql.yml", uses("github/codeql-action/init", NEW) + uses("github/codeql-action/analyze", OLD)],
  ]);
  assert.equal(drifted.length, 1);
  assert.match(drifted[0], /github\/codeql-action is pinned to 2 different commits/u);
  // It has to say WHERE, or the reader cannot act on it.
  assert.match(drifted[0], /codeql\.yml/u);

  // A repository can publish a root action alongside sub-actions, so a missing
  // subpath is still the same family. Requiring one missed this entirely.
  const rootDrift = findActionFamilyDrift([
    ["codeql.yml", uses("github/codeql-action", OLD) + uses("github/codeql-action/init", NEW)],
  ]);
  assert.equal(rootDrift.length, 1);
  assert.match(rootDrift[0], /github\/codeql-action is pinned to 2 different commits/u);

  // A single-path action agreeing with itself is not a finding.
  assert.deepEqual(
    findActionFamilyDrift([
      ["a.yml", uses("actions/checkout", NEW)],
      ["b.yml", uses("actions/checkout", NEW)],
    ]),
    [],
  );

  // Across files counts too — upload-sarif lives in a different workflow.
  assert.equal(
    findActionFamilyDrift([
      ["codeql.yml", uses("github/codeql-action/init", NEW)],
      ["scorecard.yml", uses("github/codeql-action/upload-sarif", OLD)],
    ]).length,
    1,
  );

  // Agreement is not a finding, and neither is a single-path action that
  // happens to sit at a different commit from an unrelated one.
  assert.deepEqual(
    findActionFamilyDrift([
      ["codeql.yml", uses("github/codeql-action/init", NEW) + uses("github/codeql-action/analyze", NEW)],
      ["ci.yml", uses("gradle/actions/setup-gradle", OLD)],
    ]),
    [],
  );

  // The repository's own workflows satisfy it.
  const root = resolve(import.meta.dirname, "..");
  assert.deepEqual(
    findActionFamilyDrift(
      listWorkflowFiles().map((path) => [
        path,
        readFileSync(resolve(root, path), "utf8"),
      ]),
    ),
    [],
  );
});

test("the workflow audit actually reports action-family drift", async () => {
  // Calling findActionFamilyDrift directly proves the function; it does not
  // prove auditWorkflowFiles consults it. Dropping it from the aggregate left
  // every direct test passing, so this drives the real entry point.
  const root = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(resolve(root, "scripts/.drift-fixture-"));
  const relative = scratch.slice(root.length + 1);
  const workflow = (sha) =>
    [
      "name: fixture",
      "permissions: read-all",
      "on: push",
      "jobs:",
      "  a:",
      "    runs-on: ubuntu-latest",
      "    permissions: read-all",
      "    steps:",
      `      - uses: github/codeql-action/init@${sha} # v4`,
      "",
    ].join("\n");

  try {
    writeFileSync(
      resolve(scratch, "one.yml"),
      workflow("db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28"),
    );
    writeFileSync(
      resolve(scratch, "two.yml"),
      workflow("cdf488f595d80d6e07e03d4674febd5ab45fa938"),
    );
    await assert.rejects(
      auditWorkflowFiles([`${relative}/one.yml`, `${relative}/two.yml`]),
      /pinned to 2 different commits/u,
    );
    // And it passes when they agree, so the rejection is the drift.
    writeFileSync(
      resolve(scratch, "one.yml"),
      workflow("cdf488f595d80d6e07e03d4674febd5ab45fa938"),
    );
    await auditWorkflowFiles([`${relative}/one.yml`, `${relative}/two.yml`]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
