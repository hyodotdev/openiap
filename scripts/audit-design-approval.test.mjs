import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approvalLink,
  needsDesignApproval,
  verifyDesignApproval,
} from "./audit-design-approval.mjs";

const repository = "hyodotdev/openiap";
const url = `https://github.com/${repository}/issues/123#issuecomment-456`;
const link = approvalLink(`Design approval: ${url}`, repository);
const before = "2026-10-01T08:00:00Z";
const after = "2026-10-01T09:00:00Z";
const contractPath = "specs/commerce-protocol/SPEC.md";
const testPath = "specs/commerce-protocol/test/conformance.test.mjs";
const testName = "rejects a malformed receipt";

function fixture() {
  return {
    pull: {
      head: {
        sha: "head",
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
  assert.deepEqual(link, { url, comment: "456" });
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
      "Tests/RestoreTests.swift",
      "testRestore",
      "@MainActor override func testRestore() async { XCTAssertTrue(verified) }",
    ],
    [
      "src/test/RestoreTests.kt",
      "restores a purchase",
      "@Test internal fun `restores a purchase`() { assertTrue(verified) }",
    ],
    [
      "tests/RestoreTests.cs",
      "TestRestore",
      "[Fact] public async Task TestRestore() { Assert.True(await Verify()); }",
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
});

test("rejects empty and disabled native verification methods", () => {
  const value = fixture();
  for (const [path, source] of [
    ["Tests/RestoreTests.swift", "func testRestore() { /* test later */ }"],
    [
      "Tests/RestoreTests.swift",
      "/*\nfunc testRestore() { XCTAssertTrue(verified) }\n*/",
    ],
    ["Tests/RestoreTests.swift", "func testRestore() { let fixture = true }"],
    [
      "Tests/RestoreTests.swift",
      "func testRestore() throws { verify(); try XCTSkipIf(true) }",
    ],
    [
      "Tests/RestoreTests.swift",
      "static func testRestore() { XCTAssertTrue(verified) }",
    ],
    [
      "src/test/RestoreTests.kt",
      "@Disabled\n@Test\nfun testRestore() { assertTrue(verified) }",
    ],
    [
      "src/test/RestoreTests.kt",
      "@Test fun testRestore() { Assumptions.assumeTrue(false); assertTrue(verified) }",
    ],
    [
      "tests/RestoreTests.cs",
      '[Fact(Skip = "disabled")]\npublic void testRestore() { Assert.True(verified); }',
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
