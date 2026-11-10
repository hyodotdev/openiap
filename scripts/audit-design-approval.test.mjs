import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import {
  approvalGateChanges,
  assertApprovalUnused,
  evidenceJobs,
  needsDesignApproval,
  verifyDesignApproval,
} from "./audit-design-approval.mjs";
import { approvalLink } from "./approved-verification.mjs";

const repository = "hyodotdev/openiap";
const url = `https://github.com/${repository}/issues/123#issuecomment-456`;
const link = approvalLink(`Design approval: ${url}`, repository);
const before = "2026-10-01T08:00:00Z";
const after = "2026-10-01T09:00:00Z";
const contractPath = "specs/commerce-protocol/SPEC.md";
const testPath = "specs/commerce-protocol/test/conformance.test.mjs";
const testName = "rejects a malformed receipt";
const swiftTest = "packages/apple/Tests/OpenIapTests/RestoreTests.swift";
const kotlinTest = "packages/google/core/src/test/java/dev/hyo/RestoreTests.kt";
const csharpTest =
  "libraries/maui-iap/tests/OpenIap.Maui.Tests/RestoreTests.cs";

function fixture() {
  return {
    pull: {
      number: 30,
      head: {
        sha: "head",
        label: "contributor:feature",
        repo: { full_name: "contributor/openiap" },
        ref: "feature",
      },
      base: { repo: { full_name: repository }, ref: "main" },
      created_at: after,
      commits: 1,
    },
    link,
    files: [contractPath, testPath],
    readTest: (path) =>
      path === testPath
        ? `describe("receipt", () => { it("${testName}", () => { expect(rejectReceipt()).toBe(true); }); });`
        : undefined,
    comment: {
      html_url: url,
      user: { id: 27461460 },
      body: [
        "Approved public contract design for contributor/openiap:feature into hyodotdev/openiap:main",
        "Design: Reject malformed receipt documents at the protocol boundary.",
        `Contract: ${contractPath}`,
        "Acceptance: Valid receipts pass and malformed receipts are rejected.",
        `Verification: ${testPath}#${testName}`,
      ].join("\n"),
      created_at: before,
      updated_at: before,
    },
    commits: [
      {
        sha: "head",
        commit: { author: { date: after }, committer: { date: after } },
      },
    ],
  };
}

test("authored contract paths and declared runtime changes require approval", () => {
  for (const file of [
    "specs/client/src/type.graphql",
    "libraries/react-native-iap/src/index.ts",
    "libraries/expo-iap/src/index.ts",
    "packages/kit/convex/commerce/delivery.ts",
    "packages/kit/server/api/commerce/routes.ts",
    "specs/client/src/capability-matrix.mjs",
    "specs/client/src/generated/types.ts",
    "packages/conformance/src/spec/provider-profile.mjs",
    "specs/commerce-protocol/generated/bindings/http-binding.json",
    "specs/client/src/purchase-flow.vectors.json",
    "specs/client/src/purchase-flow-confirmers.ts",
    "specs/client/src/purchase-flow.ts",
    "specs/commerce-protocol/conformance/index.mjs",
    "packages/conformance/src/spec/behaviors.mjs",
    "specs/commerce-protocol/SPEC.md",
    "specs/commerce-protocol/schema/02-commerce-event.graphql",
    "specs/commerce-protocol/vectors/signatures.json",
    "specs/commerce-protocol/src/index.d.ts",
    "specs/commerce-protocol/conformance/index.d.ts",
  ])
    assert.equal(needsDesignApproval([file], ""), true, file);
  assert.equal(
    needsDesignApproval(
      ["packages/kit/server/handler.ts"],
      "Public contract: changed",
    ),
    true,
  );
  assert.equal(
    needsDesignApproval(["specs/commerce-protocol/test/vectors.test.mjs"], ""),
    false,
  );
});

test("requires a public impact decision for shipped implementation changes", () => {
  for (const file of ["libraries/expo-iap/src/purchase-flow.ts"]) {
    assert.throws(() => needsDesignApproval([file], ""), /Classify/);
    assert.equal(
      needsDesignApproval([file], "Public contract: unchanged"),
      false,
    );
    assert.equal(needsDesignApproval([file], "Public contract: changed"), true);
  }
  assert.throws(
    () =>
      needsDesignApproval(
        ["specs/client/src/type.graphql"],
        "Public contract: unchanged",
      ),
    /needs design approval/,
  );
  assert.throws(
    () =>
      needsDesignApproval(
        [],
        "Public contract: unchanged\nPublic contract: changed",
      ),
    /single Public contract/,
  );
});

test("requires a single same-repository issue comment URL", () => {
  assert.deepEqual(link, { url, issue: "123", comment: "456" });
  for (const body of [
    "",
    `Design approval: ${url}\nDesign approval: ${url}`,
    `Design approval: ${url.replace("/issues/", "/pull/")}`,
    `Design approval: ${url.replace("hyodotdev", "someone-else")}`,
  ]) {
    assert.throws(() => approvalLink(body, repository));
  }
});

test("accepts an explicit unedited approval for this branch before implementation", () => {
  assert.doesNotThrow(() => verifyDesignApproval(fixture()));
});

test("rejects an approval without acceptance and verification evidence", () => {
  for (const field of ["Acceptance", "Verification"]) {
    const value = fixture();
    value.comment.body = value.comment.body.replace(
      new RegExp(`^${field}:.*$`, "m"),
      `${field}: `,
    );
    assert.throws(() => verifyDesignApproval(value), new RegExp(`${field}:`));
  }
});

test("rejects placeholder approval and an unapproved public source", () => {
  const value = fixture();
  value.comment.body = value.comment.body.replace(
    /^Acceptance:.*$/m,
    "Acceptance: TBD",
  );
  assert.throws(() => verifyDesignApproval(value), /Acceptance:/);
  value.comment.body = fixture().comment.body;
  value.files.push("specs/commerce-protocol/schema/02-commerce-event.graphql");
  assert.throws(() => verifyDesignApproval(value), /approved Contract:/);
});

test("rejects unchanged declarations for SDK entry points and Kit Commerce runtime", () => {
  for (const path of [
    "libraries/react-native-iap/src/index.ts",
    "libraries/expo-iap/src/index.ts",
    "packages/kit/convex/commerce/delivery.ts",
    "packages/kit/server/api/commerce/routes.ts",
  ]) {
    assert.equal(needsDesignApproval([path], ""), true, path);
    assert.throws(
      () => needsDesignApproval([path], "Public contract: unchanged"),
      /needs design approval/,
      path,
    );
  }
  assert.equal(
    needsDesignApproval(["packages/kit/convex/commerce/delivery.test.ts"], ""),
    false,
  );
});

test("requires a named executable test in the current tree", () => {
  const value = fixture();
  for (const source of [
    `it("${testName}", () => {});`,
    `it("${testName}", () => undefined);`,
    `it("${testName}", (ctx) => ctx.skip());`,
    `it("${testName}", (ctx) => { ctx["skip"](); });`,
    `it("${testName}", (ctx) => run(() => ctx.skip()));`,
    `it("${testName}", () => { const unused = () => verify(); });`,
    `it("${testName}", () => { return; verify(); });`,
    `it("${testName}", () => pending());`,
    `it.skip("${testName}", () => expect(true).toBe(true));`,
    `describe.skip("receipt", () => { it("${testName}", () => expect(true).toBe(true)); });`,
    `describe.skipIf(true)("receipt", () => { it("${testName}", () => expect(true).toBe(true)); });`,
    undefined,
  ]) {
    value.readTest = () => source;
    assert.throws(
      () => verifyDesignApproval(value),
      /test was not found or is empty or disabled/,
    );
  }
  value.comment.body = value.comment.body.replace(
    /^Verification:.*$/m,
    "Verification: test later",
  );
  assert.throws(() => verifyDesignApproval(value), /repository test path/);
});

test("finds native tests with attributes, modifiers, and async return types", () => {
  for (const [path, name, declaration] of [
    [
      swiftTest,
      "testRestore",
      "@MainActor override func testRestore() async { XCTAssertTrue(verified) }",
    ],
    [
      swiftTest,
      "testRestore",
      "func testRestore() {\n  for expected in outcomes { XCTAssertEqual(actual, expected) }\n}",
    ],
    [
      kotlinTest,
      "restores a purchase",
      "@Disabled class Other {}\nclass Active {\n@Test internal fun `restores a purchase`() = runTest { assertTrue(verified) }\n}",
    ],
    [
      csharpTest,
      "TestRestore",
      "[Fact] public async Task TestRestore() { var result = await Verify(); Assert.False(result.Skip); }",
    ],
    [
      csharpTest,
      "TestRestore",
      "[Fact] public void TestRestore() { foreach (var expected in outcomes) { Assert.Equal(actual, expected); } }",
    ],
  ]) {
    const value = fixture();
    value.comment.body = value.comment.body.replace(
      /^Verification:.*$/m,
      `Verification: ${path}#${name}`,
    );
    value.readTest = (file) => (file === path ? declaration : undefined);
    assert.doesNotThrow(() => verifyDesignApproval(value), declaration);
  }
  // A test no required CI job runs cannot show its result.
  const value = fixture();
  const untested = "libraries/godot-iap/ios/Tests/RestoreTests.swift";
  value.comment.body = value.comment.body.replace(
    /^Verification:.*$/m,
    `Verification: ${untested}#testRestore`,
  );
  value.readTest = () => "func testRestore() { XCTAssertTrue(verified) }";
  assert.throws(() => verifyDesignApproval(value), /No required CI job runs/);
});

test("rejects empty and disabled native verification methods", () => {
  const value = fixture();
  for (const [path, source] of [
    [swiftTest, "func testRestore() { /* test later */ }"],
    [swiftTest, "/*\nfunc testRestore() { XCTAssertTrue(verified) }\n*/"],
    [swiftTest, "func testRestore() { let fixture = true }"],
    [swiftTest, "func testRestore() { let unused = { XCTAssertTrue(false) } }"],
    [swiftTest, "func testRestore() throws { verify(); try XCTSkipIf(true) }"],
    [swiftTest, "static func testRestore() { XCTAssertTrue(verified) }"],
    [
      kotlinTest,
      "@Disabled\n@Test\nfun testRestore() { assertTrue(verified) }",
    ],
    [
      kotlinTest,
      "@Disabled\n// Pending a StoreKit fixture.\ninternal class RestoreTests {\n  @Test fun testRestore() { assertTrue(verified) }\n}",
    ],
    [
      kotlinTest,
      "@Test fun testRestore() { fun unused() { assertTrue(false) } }",
    ],
    [
      kotlinTest,
      "@Test fun testRestore() { Assumptions.assumeTrue(false); assertTrue(verified) }",
    ],
    [
      csharpTest,
      '[Fact(Skip = "disabled")]\npublic void testRestore() { Assert.True(verified); }',
    ],
    [
      csharpTest,
      '[Test]\npublic void testRestore() { Assert.Inconclusive("unverified"); }',
    ],
    [
      csharpTest,
      '[Ignore("disabled")]\n/* Pending a fixture. */\npublic sealed class RestoreTests {\n  [Test] public void testRestore() { Assert.True(verified); }\n}',
    ],
    [
      csharpTest,
      "[Test] public void testRestore() { void unused() { Assert.True(false); } }",
    ],
    [
      csharpTest,
      '[Test] public void testRestore() { string unused() { Assert.True(false); return ""; } }',
    ],
    [
      csharpTest,
      "[Test] public void testRestore() { Action unused = () => Assert.True(false); }",
    ],
    [
      csharpTest,
      "[Test] public void testRestore() { Action unused = delegate { Assert.True(false); }; }",
    ],
  ]) {
    value.comment.body = value.comment.body.replace(
      /^Verification:.*$/m,
      `Verification: ${path}#testRestore`,
    );
    value.readTest = () => source;
    assert.throws(
      () => verifyDesignApproval(value),
      /is empty or disabled/,
      source,
    );
  }
});

test("rejects an unrelated, edited, or unauthorized approval", () => {
  const value = fixture();
  value.comment.user.id = 1;
  assert.throws(() => verifyDesignApproval(value), /project lead/);
  value.comment.user.id = 27461460;
  value.comment.html_url = url.replace("/123", "/999");
  assert.throws(() => verifyDesignApproval(value), /linked issue comment/);
  value.comment.html_url = url;
  value.comment.body = value.comment.body.replace(":feature", ":other");
  assert.throws(() => verifyDesignApproval(value), /must name/);
  value.comment.body = fixture().comment.body;
  value.comment.updated_at = after;
  assert.throws(() => verifyDesignApproval(value), /unedited/);
});

test("rejects approval after an original commit even if it was committed again later", () => {
  const value = fixture();
  value.commits[0].commit.author.date = before;
  assert.throws(() => verifyDesignApproval(value), /predate/);
  value.commits[0].commit.author.date = after;
  value.pull.created_at = before;
  assert.throws(() => verifyDesignApproval(value), /predate/);
});

test("rejects incomplete or stale commit responses", () => {
  const value = fixture();
  value.pull.commits = 2;
  assert.throws(() => verifyDesignApproval(value), /complete commit list/);
  value.pull.commits = 1;
  value.commits[0].sha = "stale";
  assert.throws(() => verifyDesignApproval(value), /complete commit list/);
});

test("approval names the target repository and branch", () => {
  const value = fixture();
  value.pull.base.ref = "different-base";
  assert.throws(() => verifyDesignApproval(value), /must name/);
});

test("verifies all commits in a PR that spans multiple API pages", () => {
  const value = fixture();
  value.commits = [
    ...Array.from({ length: 100 }, (_, index) => ({
      ...value.commits[0],
      sha: `commit-${index}`,
    })),
    ...value.commits,
  ];
  value.pull.commits = value.commits.length;
  assert.doesNotThrow(() => verifyDesignApproval(value));
  value.commits.shift();
  assert.throws(() => verifyDesignApproval(value), /complete commit list/);
});

const useIap = "libraries/react-native-iap/src/hooks/useIAP.ts";

test("a declaration change must be in the approved Contract scope", () => {
  const value = fixture();
  value.files = [useIap, testPath];
  value.surfaceChanged = [useIap];
  assert.throws(() => verifyDesignApproval(value), /Contract: paths/);
  value.comment.body = value.comment.body.replace(
    `Contract: ${contractPath}`,
    `Contract: ${useIap}`,
  );
  assert.doesNotThrow(() => verifyDesignApproval(value));
});

test("an approved change cannot also change the CI that runs its tests", () => {
  const ci = ".github/workflows/ci.yml";
  const workflow = (
    evidence,
    other = "true",
    trigger = "main",
    ios = "approved-verification.mjs apple",
  ) =>
    `on:\n  pull_request:\n    branches: [${trigger}]\njobs:\n  audit-release-state:\n    steps:\n      - run: ${evidence}\n  test-ios:\n    steps:\n      - run: ${ios}\n  other:\n    steps:\n      - run: ${other}\n`;
  const gate = (head, files = [ci]) =>
    approvalGateChanges(files, (side, path) =>
      path === ci ? (side === "base" ? workflow("verify") : head) : "x",
    );
  assert.deepEqual(gate(workflow("verify", "false")), []);
  for (const head of [
    workflow("true"),
    workflow("verify", "true", "nowhere"),
    workflow("verify", "true", "main", "true"),
    workflow("verify").replace(
      "jobs:",
      "env:\n  NODE_OPTIONS: --require ./x.js\njobs:",
    ),
  ]) {
    assert.deepEqual(gate(head), [
      `${ci} (an evidence job or its workflow settings)`,
    ]);
  }
  assert.deepEqual(
    gate(workflow("verify"), [
      "scripts/approved-verification.mjs",
      "scripts/audit-design-approval.mjs",
      ".github/workflows/design-approval.yml",
    ]),
    [
      "scripts/approved-verification.mjs",
      "scripts/audit-design-approval.mjs",
      ".github/workflows/design-approval.yml",
    ],
  );
  const value = fixture();
  value.gateChanged = ["scripts/approved-verification.mjs"];
  assert.throws(() => verifyDesignApproval(value), /separate PR/);
});

test("an approved change cannot change a CI helper an evidence job runs", () => {
  const { jobs } = parseYaml(
    readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    ),
  );
  const helpers = new Set();
  for (const job of evidenceJobs) {
    const { steps } = jobs[job];
    const check = steps.findLastIndex(({ run }) =>
      run?.includes("approved-verification.mjs"),
    );
    // Later steps cannot change what the check read.
    for (const { uses = "", run = "" } of steps.slice(0, check + 1)) {
      if (uses.startsWith("./")) helpers.add(`${uses.slice(2)}/action.yml`);
      for (const [script] of run.matchAll(
        /(?<![\w$])(?:[\w-]+\/)+[\w.-]+\.(?:mjs|sh)/g,
      )) {
        helpers.add(script);
      }
    }
  }
  assert.ok(helpers.has("scripts/ci/retry-gradle.sh"));
  assert.ok(helpers.has(".github/actions/setup-xcode/action.yml"));
  assert.deepEqual(
    approvalGateChanges([...helpers, "packages/google/build.gradle.kts"]),
    [...helpers],
  );
});

test("a merged PR uses an approval up", () => {
  const { pull, comment } = fixture();
  const merged = (number, label, body = "", mergedAt = after) => ({
    number,
    body,
    head: { label },
    merged_at: mergedAt,
  });
  for (const other of [
    merged(12, "contributor:feature"),
    merged(13, "maintainer:docs", `Design approval: ${url}`),
    // Its body was edited after the merge to link another approval.
    merged(
      17,
      "contributor:feature",
      `Design approval: ${url.replace("456", "455")}`,
    ),
  ]) {
    assert.throws(
      () => assertApprovalUnused(link, pull, comment, [other]),
      new RegExp(`already used by merged PR #${other.number}`),
    );
  }
  // This PR, an unmerged one, a branch merged before the approval, and a
  // merged PR from another branch that only mentions the issue do not use it.
  assert.doesNotThrow(() =>
    assertApprovalUnused(link, pull, comment, [
      merged(30, "contributor:feature"),
      merged(14, "contributor:feature", "", null),
      merged(15, "contributor:feature", "", "2026-09-01T00:00:00Z"),
      merged(16, "maintainer:docs", "Refs the proposal issue."),
    ]),
  );
});
