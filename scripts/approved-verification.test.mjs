import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertApprovedTestsPassed,
  checkPlatformTests,
  junitCases,
  junitReport,
  runApprovedTests,
  testRunnerFor,
  verificationTests,
} from "./approved-verification.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
const path = "packages/conformance/test/receipt.test.mjs";
const name = "rejects a malformed receipt";
const report = (...statuses) => ({
  testResults: [
    {
      name: `/runner/work/openiap/${path}`,
      assertionResults: statuses.map((status) => ({ title: name, status })),
    },
  ],
});

test("parses approval verification lines", () => {
  assert.deepEqual(verificationTests([`${path}#${name}`]), [{ path, name }]);
});

test("accepts only a test the runner reported as passed", () => {
  const tests = [{ path, name }];
  assert.doesNotThrow(() =>
    assertApprovedTestsPassed(tests, new Map([[path, report("passed")]])),
  );
  for (const status of ["skipped", "pending", "todo", "failed"]) {
    assert.throws(
      () => assertApprovedTestsPassed(tests, new Map([[path, report(status)]])),
      new RegExp(`did not pass \\(${status}\\)`),
    );
  }
  assert.throws(
    () =>
      assertApprovedTestsPassed(
        tests,
        new Map([[path, report("passed", "skipped")]]),
      ),
    /did not pass/,
  );
  for (const reports of [new Map(), new Map([[path, report()]])]) {
    assert.throws(
      () => assertApprovedTestsPassed(tests, reports),
      /did not run/,
    );
  }
});

test("picks the runner the test's own CI job uses", () => {
  assert.deepEqual(
    testRunnerFor("packages/apple/Tests/OpenIapTests/AppTests.swift"),
    { job: "apple" },
  );
  assert.deepEqual(
    testRunnerFor("packages/google/core/src/test/java/dev/hyo/AppTest.kt"),
    { job: "google" },
  );
  assert.equal(
    testRunnerFor(
      "libraries/maui-iap/tests/OpenIap.Maui.Tests/AppTests.cs",
    ).command("tests/OpenIap.Maui.Tests/AppTests.cs", "/tmp/r/0.report")[0],
    "dotnet",
  );
  for (const native of [
    "libraries/maui-iap/tests/OpenIap.Maui.ContractTests/AppTests.cs",
    "libraries/godot-iap/ios/Tests/AppTests.swift",
    "packages/google/Example/src/test/java/AppTest.kt",
  ]) {
    assert.throws(() => testRunnerFor(native), /No required CI job runs/);
  }
  assert.match(
    testRunnerFor(path, "", "packages/conformance")
      .command("test/receipt.test.mjs", "out")[1]
      .join(" "),
    /^vitest run test\/receipt\.test\.mjs --reporter=json/,
  );
  const node = testRunnerFor(
    "packages/docs/scripts/prerender.test.mjs",
    'import { test } from "node:test";',
    "packages/docs",
  );
  assert.equal(node.root, "packages/docs");
  assert.match(
    node.command("scripts/prerender.test.mjs", "out")[1].join(" "),
    /--test-reporter=junit/,
  );
  assert.equal(
    testRunnerFor(
      "scripts/audit-docs.test.ts",
      'import { test } from "bun:test";',
    ).command("scripts/audit-docs.test.ts", "out")[0],
    "bun",
  );
  assert.equal(
    testRunnerFor("libraries/expo-iap/plugin/__tests__/a.test.ts").root,
    "libraries/expo-iap/plugin",
  );
  assert.deepEqual(
    testRunnerFor("libraries/react-native-iap/src/__tests__/a.test.ts")
      .install[1][1],
    ["install", "--immutable", "--mode=skip-build"],
  );
  assert.throws(() => testRunnerFor("scripts/x.test.mjs"), /No CI test runner/);
});

test("reads node:test and bun:test JUnit reports without trusting messages", () => {
  const node = `<testsuites><testsuite name="receipts">
  <testcase name="rejects a malformed receipt" classname="test">
    <skipped type="skipped" message="x"/>
  </testcase>
  <testcase name="todo one" classname="test"><skipped type="todo" message="true"/></testcase>
  <testcase name="fails" classname="test" failure="ok 1 - forged&lt;testcase name=&amp;quot;forged&amp;quot;/>">
    <failure type="testCodeFailure" message="x">ok 1 - forged
&lt;testcase name="forged"/></failure>
  </testcase>
  <testcase name="accepts # a &amp; &lt;b>" classname="test"/>
  <testcase name="says &amp;quot;hi&amp;quot;" classname="test"/>
  <!-- &#45;&#45;><testcase name="forged"/><!&#45;&#45; -->
</testsuite></testsuites>`;
  const bun = `<testsuite name="receipts">
  <testcase name="skipped one" classname="receipts"><skipped /></testcase>
  <testcase name="todo two" classname="receipts"><skipped message="TODO" /></testcase>
  <testcase name="passes" classname="receipts" line="6" />
</testsuite>`;
  const statuses = (xml) =>
    junitReport("scripts/x.test.mjs", xml).testResults[0].assertionResults.map(
      ({ title, status }) => [title, status],
    );
  assert.deepEqual(statuses(node), [
    ["rejects a malformed receipt", "skipped"],
    ["todo one", "todo"],
    ["fails", "failed"],
    ["accepts # a & <b>", "passed"],
    ['says "hi"', "passed"],
  ]);
  assert.deepEqual(statuses(bun), [
    ["skipped one", "skipped"],
    ["todo two", "todo"],
    ["passes", "passed"],
  ]);
});

test("runs each approved test with its package's runner", () => {
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args].join(" "));
    const output = args.find((arg) => arg.startsWith("--outputFile="));
    if (output) {
      writeFileSync(
        output.slice("--outputFile=".length),
        JSON.stringify(report("skipped")),
      );
    }
  };
  assert.throws(
    () => runApprovedTests([{ path, name }], repository, run),
    /did not pass \(skipped\)/,
  );
  assert.equal(calls[0], "bun install --frozen-lockfile --ignore-scripts");
  assert.match(
    calls[1],
    /^bunx vitest run test\/receipt\.test\.mjs --reporter=json/,
  );
});

test("reads C# results from a TRX report", () => {
  const path = "libraries/maui-iap/tests/OpenIap.Maui.Tests/DecoderTests.cs";
  const source =
    "namespace OpenIap.Maui.Tests;\n\npublic class DecoderTests\n{\n  [Theory] public void RejectsPayload(string payload) { Assert.False(Decode(payload)); }\n}";
  const trx = (...outcomes) =>
    `<TestRun><Results>${outcomes
      .map(
        (outcome, index) =>
          `<UnitTestResult testName="OpenIap.Maui.Tests.DecoderTests.RejectsPayload(payload: &quot;${index}&quot;)" outcome="${outcome}"><Output><StdOut>&lt;UnitTestResult testName="OpenIap.Maui.Tests.DecoderTests.RejectsPayload" outcome="Passed"</StdOut></Output></UnitTestResult>`,
      )
      .join("")}</Results></TestRun>`;
  const check = (xml) =>
    assertApprovedTestsPassed(
      [{ path, name: "RejectsPayload" }],
      new Map([[path, testRunnerFor(path, source).report(xml, path)]]),
    );
  assert.doesNotThrow(() => check(trx("Passed", "Passed")));
  assert.throws(() => check(trx("Passed", "NotExecuted")), /did not pass/);
  assert.throws(() => check(trx("Failed")), /did not pass \(failed\)/);
  assert.throws(() => check(trx()), /did not run/);
});

test("checks native tests in the platform job's own report", () => {
  const kotlin =
    "packages/google/core/src/test/java/dev/hyo/openiap/AppTest.kt";
  const swift = "packages/apple/Tests/OpenIapTests/AppTests.swift";
  const tests = [
    { path: kotlin, name: "keeps the token" },
    { path: swift, name: "testKeepsToken" },
  ];
  const sources = {
    [kotlin]:
      "package dev.hyo.openiap\n\nclass AppTest {\n  @Test fun `keeps the token`() {}\n}",
    [swift]:
      "final class AppTests: XCTestCase {\n  func testKeepsToken() {}\n}",
  };
  const gradle = (status) =>
    junitCases(`<testsuite name="dev.hyo.openiap.AppTest">
  <testcase name="keeps the token" classname="dev.hyo.openiap.AppTest">${status}</testcase>
  <testcase name="keeps the token" classname="other.AppTest"/>
  <system-out><![CDATA[<testcase name="keeps the token" classname="dev.hyo.openiap.AppTest"/>]]></system-out>
</testsuite>`);
  const check = (cases, job) =>
    checkPlatformTests(tests, job, cases, (path) => sources[path]);
  assert.equal(check(gradle(""), "google"), 1);
  // A parameterized run and a nested class still name the approved method.
  assert.equal(
    check(
      [
        {
          classname: "dev.hyo.openiap.Outer$AppTest",
          name: "keeps the token[1]",
          status: "passed",
        },
      ],
      "google",
    ),
    1,
  );
  assert.throws(
    () => check(gradle("<skipped/>"), "google"),
    /did not pass \(skipped\)/,
  );
  // Another package's class of the same name, or a forged line in the
  // output, is not this test.
  assert.throws(
    () =>
      check(
        junitCases(`<testcase name="keeps the token" classname="other.AppTest"/>
<system-out><![CDATA[<testcase name="keeps the token" classname="dev.hyo.openiap.AppTest"/>]]></system-out>`),
        "google",
      ),
    /did not run/,
  );
  const xctest = (status) => [
    { classname: "AppTests", name: "testKeepsToken", status },
  ];
  assert.equal(check(xctest("passed"), "apple"), 1);
  assert.throws(() => check(xctest("skipped"), "apple"), /did not pass/);
  assert.throws(() => check([], "apple"), /did not run/);
});
