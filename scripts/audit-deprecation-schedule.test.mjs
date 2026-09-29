import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractSchemaDeprecations } from "../specs/client/schema-deprecations.mjs";
import {
  activeDocsForbiddenTokens,
  collectForbiddenMatches,
  collectMissingRequiredTexts,
  collectRepositorySchemaDeprecations,
  collectSchemaDeprecationFailures,
  completedRemovalRules,
} from "./audit-deprecation-schedule.mjs";
import {
  collectScheduledRemovalFailures,
  releaseGateFailure,
  releaseTagOf,
  scheduledRemovalRules,
} from "./scheduled-removals.mjs";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("completed removal inventory covers every coordinated package", () => {
  assert.deepEqual(
    completedRemovalRules.map((rule) => rule.label),
    [
      "shared schema and generated contracts",
      "openiap-apple",
      "openiap-google",
      "react-native-iap",
      "expo-iap",
      "flutter_inapp_purchase",
      "godot-iap",
      "kmp-iap",
      "OpenIap.Maui",
    ],
  );
});

test("active docs guard includes removed API families", () => {
  for (const token of [
    "validateReceipt",
    "getStorefrontIOS",
    "requestPurchaseOnPromotedProductIOS",
    "alternativeBillingModeAndroid",
    "subscriptionOfferDetailsAndroid",
  ]) {
    assert.ok(activeDocsForbiddenTokens.includes(token));
  }
});

test("forbidden matcher reports every occurrence with its line", () => {
  const root = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
  );
  const fixtureDirectory = fs.mkdtempSync(
    path.join(root, ".audit-deprecations-fixture-"),
  );
  const relativeDirectory = path.relative(root, fixtureDirectory);
  const fixture = path.join(fixtureDirectory, "fixture.ts");
  try {
    fs.writeFileSync(
      fixture,
      "export const first = 'legacy';\nexport const second = 'legacy';\n",
    );
    assert.deepEqual(
      collectForbiddenMatches({
        roots: [relativeDirectory],
        tokens: ["legacy"],
      }),
      [
        { file: `${relativeDirectory}/fixture.ts`, line: 1, token: "legacy" },
        { file: `${relativeDirectory}/fixture.ts`, line: 2, token: "legacy" },
      ],
    );
  } finally {
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("forbidden matcher honors excluded directories", () => {
  const root = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
  );
  const fixtureDirectory = fs.mkdtempSync(
    path.join(root, ".audit-deprecations-fixture-"),
  );
  const relativeDirectory = path.relative(root, fixtureDirectory);
  try {
    fs.writeFileSync(path.join(fixtureDirectory, "fixture.ts"), "legacy\n");
    assert.deepEqual(
      collectForbiddenMatches({
        roots: [relativeDirectory],
        excluded: [relativeDirectory],
        tokens: ["legacy"],
      }),
      [],
    );
  } finally {
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("forbidden matcher does not follow generated symbolic-link loops", () => {
  const root = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
  );
  const fixtureDirectory = fs.mkdtempSync(
    path.join(root, ".audit-deprecations-fixture-"),
  );
  const relativeDirectory = path.relative(root, fixtureDirectory);
  try {
    fs.writeFileSync(path.join(fixtureDirectory, "fixture.ts"), "legacy\n");
    fs.symlinkSync(fixtureDirectory, path.join(fixtureDirectory, "loop"));
    assert.deepEqual(
      collectForbiddenMatches({
        roots: [relativeDirectory],
        tokens: ["legacy"],
      }),
      [
        {
          file: `${relativeDirectory}/fixture.ts`,
          line: 1,
          token: "legacy",
        },
      ],
    );
  } finally {
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("forbidden matcher supports explicitly guarded documentation files", () => {
  const root = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
  );
  const fixtureDirectory = fs.mkdtempSync(
    path.join(root, ".audit-deprecations-fixture-"),
  );
  const relativeDirectory = path.relative(root, fixtureDirectory);
  try {
    fs.writeFileSync(path.join(fixtureDirectory, "fixture.md"), "legacy\n");
    assert.deepEqual(
      collectForbiddenMatches({
        roots: [relativeDirectory],
        tokens: ["legacy"],
        extensions: new Set([".md"]),
      }),
      [
        {
          file: `${relativeDirectory}/fixture.md`,
          line: 1,
          token: "legacy",
        },
      ],
    );
  } finally {
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("required text guard fails closed for missing files and values", () => {
  assert.deepEqual(
    collectMissingRequiredTexts([
      {
        file: ".missing-openiap-major-doc.md",
        values: ["required"],
      },
    ]),
    [
      {
        file: ".missing-openiap-major-doc.md",
        value: "required",
      },
    ],
  );
});

test("repository schema deprecations all target a future removal train", () => {
  const deprecations = collectRepositorySchemaDeprecations();
  assert.deepEqual(deprecations.issues, []);

  const clientProtocolMajor = Number(
    JSON.parse(
      fs.readFileSync(path.join(repoRoot, "specs/client/package.json"), "utf8"),
    ).version.split(".")[0],
  );
  for (const entry of deprecations.entries) {
    const removalMajor = Number(
      /client protocol (\d+)\.\d+\.\d+\.$/.exec(entry.reason)?.[1],
    );
    assert.ok(
      Number.isFinite(removalMajor),
      `${entry.ownerPath} must name its removal train`,
    );
    assert.ok(
      removalMajor > clientProtocolMajor,
      `${entry.ownerPath} is overdue: scheduled for client protocol ${removalMajor}, client protocol is ${clientProtocolMajor}`,
    );
  }
});

test("overdue schema deprecations are reported as failures", () => {
  const overdue = extractSchemaDeprecations([
    {
      sourceId: "overdue.graphql",
      sdl: `type Query {
  old: String @deprecated(reason: "Use current. Scheduled for removal in client protocol 1.0.0.")
}`,
    },
  ]);
  assert.equal(overdue.entries.length, 1);
  assert.match(overdue.entries[0].reason, /client protocol 1\.0\.0\.$/);
  assert.match(
    collectSchemaDeprecationFailures(overdue, "2.0.0")[0],
    /is due for removal in client protocol 1 \(client protocol is 2\)/,
  );
});

test("schema deprecation audit rejects malformed spec versions", () => {
  assert.deepEqual(
    collectSchemaDeprecationFailures({ entries: [], issues: [] }, "not-semver"),
    [
      "specs/client/package.json: Invalid client protocol version: 'not-semver'",
    ],
  );
});

test("the walker skips SwiftPM checkouts of this repository", () => {
  // An iOS derivedDataPath outside the "build"/"DerivedData" names — for
  // example the ios/build-e2e-onside in .claude/commands/e2e-tests.md —
  // leaves a SourcePackages tree that vendors this repository's own sources.
  // Per process, so two runs of this suite in one checkout cannot collide.
  const name = `.tmp-source-packages-fixture-${process.pid}`;
  const fixture = path.join(repoRoot, name);
  const vendored = path.join(fixture, "SourcePackages", "checkouts", "openiap");
  const authored = path.join(fixture, "src");
  try {
    fs.mkdirSync(vendored, { recursive: true });
    fs.mkdirSync(authored, { recursive: true });
    fs.writeFileSync(path.join(vendored, "Vendored.kt"), "val x = Removed\n");
    fs.writeFileSync(path.join(authored, "Authored.kt"), "val y = Removed\n");

    const matches = collectForbiddenMatches({
      roots: [name],
      tokens: ["Removed"],
    });

    assert.deepEqual(
      matches.map((match) => match.file),
      [`${name}/src/Authored.kt`],
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

const scheduledRule = {
  label: "legacy flag",
  packages: [
    { name: "lib", major: 3, file: "version.txt", pattern: /^(\S+)$/ },
  ],
  sources: [{ file: "source.gradle", tokens: ["legacyFlag"] }],
  catalog: ["legacyFlag=true"],
};

const scheduledFiles = (overrides = {}) => {
  const files = {
    "version.txt": "3.4.0",
    "source.gradle":
      "warn('legacyFlag is deprecated and will be removed in the next major release')",
    "packages/docs/src/pages/docs/updates/migration.tsx":
      "['legacyFlag=true', 'newFlag']",
    ...overrides,
  };
  return (file) => files[file] ?? "";
};

test("a scheduled removal passes while its major keeps the key and says when it goes", () => {
  assert.deepEqual(
    collectScheduledRemovalFailures([scheduledRule], scheduledFiles()),
    [],
  );
});

test("a scheduled removal fails when a minor drops the key early", () => {
  const failures = collectScheduledRemovalFailures(
    [scheduledRule],
    scheduledFiles({
      "source.gradle": "// removed in the next major release",
    }),
  );
  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /dropped "legacyFlag" before the next major release/,
  );
});

test("a scheduled removal fails when the warning names no removal", () => {
  const failures = collectScheduledRemovalFailures(
    [scheduledRule],
    scheduledFiles({ "source.gradle": "warn('legacyFlag is deprecated')" }),
  );
  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /must say they are removed in the next major release/,
  );
});

test("a scheduled removal is due once the package ships its next major", () => {
  const failures = collectScheduledRemovalFailures(
    [scheduledRule],
    scheduledFiles({ "version.txt": "4.0.0" }),
  );
  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /lib 4\.0\.0 is past the major that deprecated them/,
  );
});

test("a scheduled removal shared by several packages goes in one major of all of them", () => {
  const shared = {
    ...scheduledRule,
    packages: [
      ...scheduledRule.packages,
      { name: "other", major: 5, file: "other.txt", pattern: /^(\S+)$/ },
    ],
  };
  const alone = collectScheduledRemovalFailures(
    [shared],
    scheduledFiles({ "version.txt": "4.0.0", "other.txt": "5.2.0" }),
  );
  assert.equal(alone.length, 1);
  assert.match(
    alone[0],
    /lib 4\.0\.0 passed its major alone; .*raise that package's major/,
  );
  assert.deepEqual(
    collectScheduledRemovalFailures(
      [shared],
      scheduledFiles({ "version.txt": "3.4.0", "other.txt": "5.2.0" }),
    ),
    [],
  );
  const failures = collectScheduledRemovalFailures(
    [shared],
    scheduledFiles({ "version.txt": "4.0.0", "other.txt": "6.0.0" }),
  );
  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /lib 4\.0\.0, other 6\.0\.0 is past the major that deprecated them/,
  );
});

test("a scheduled removal needs its migration row", () => {
  const failures = collectScheduledRemovalFailures(
    [scheduledRule],
    scheduledFiles({
      "packages/docs/src/pages/docs/updates/migration.tsx": "",
    }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /no migration row for "legacyFlag=true"/);
});

test("a scheduled removal may name the major a package is about to ship", () => {
  // A package that goes major and keeps the key raises its entry beforehand.
  for (const version of ["2.9.0", "3.0.0"]) {
    assert.deepEqual(
      collectScheduledRemovalFailures(
        [scheduledRule],
        scheduledFiles({ "version.txt": version }),
      ),
      [],
      version,
    );
  }
});

test("a scheduled removal rejects a major further ahead than the next one", () => {
  const failures = collectScheduledRemovalFailures(
    [scheduledRule],
    scheduledFiles({ "version.txt": "1.9.0" }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /names lib major 3, but the package is 1\.9\.0/);
});

test("a dropped scheduled removal needs the key gone, before and after the majors ship", () => {
  const dropped = { ...scheduledRule, dropped: true };
  const gone = { "source.gradle": "// the flag is gone" };
  for (const version of ["3.4.0", "4.0.0"]) {
    assert.deepEqual(
      collectScheduledRemovalFailures(
        [dropped],
        scheduledFiles({ ...gone, "version.txt": version }),
      ),
      [],
      version,
    );
    const back = collectScheduledRemovalFailures(
      [dropped],
      scheduledFiles({ "version.txt": version }),
    );
    assert.equal(back.length, 1, version);
    assert.match(back[0], /is marked dropped but still has "legacyFlag"/);
  }
});

test("a dropped rule names the last major that shipped the key", () => {
  const raised = {
    ...scheduledRule,
    dropped: true,
    packages: [{ ...scheduledRule.packages[0], major: 4 }],
  };
  const failures = collectScheduledRemovalFailures(
    [raised],
    scheduledFiles({ "source.gradle": "" }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /names lib major 4, but the package is 3\.4\.0/);
});

test("a package in a dropped rule can only release its next major", () => {
  const dropped = { ...scheduledRule, dropped: true };
  const files = scheduledFiles({ "source.gradle": "" });
  assert.equal(releaseGateFailure("lib", "major", [dropped], files), null);
  for (const mode of ["patch", "minor", "current"]) {
    assert.match(
      releaseGateFailure("lib", mode, [dropped], files) ?? "",
      new RegExp(
        `lib 3\\.4\\.0 has dropped legacy flag, so it must release with version=major, not ${mode}`,
      ),
    );
  }
  const released = scheduledFiles({
    "source.gradle": "",
    "version.txt": "4.0.1",
  });
  assert.equal(releaseGateFailure("lib", "patch", [dropped], released), null);
  assert.equal(
    releaseGateFailure("lib", "patch", [scheduledRule], files),
    null,
  );
  assert.equal(releaseGateFailure("other", "patch", [dropped], files), null);
});

test("a dropped rule still lets version=current retry a version that has its tag", () => {
  const dropped = { ...scheduledRule, dropped: true };
  const files = scheduledFiles({ "source.gradle": "" });
  const tagged = (name, version) => name === "lib" && version === "3.4.0";
  assert.equal(
    releaseGateFailure("lib", "current", [dropped], files, tagged),
    null,
  );
  for (const mode of ["patch", "minor"]) {
    assert.match(
      releaseGateFailure("lib", mode, [dropped], files, tagged) ?? "",
      /must release with version=major/,
      mode,
    );
  }
});

const releaseGates = {
  "release-google.yml": "openiap-google",
  "release-react-native.yml": "react-native-iap",
  "release-expo.yml": "expo-iap",
  "release-flutter.yml": "flutter_inapp_purchase",
  "release-godot.yml": "godot-iap",
  "release-kmp.yml": "kmp-iap",
  "release-maui.yml": "OpenIap.Maui",
};

test("a major release waits until every kept key of the package is raised or dropped", () => {
  const files = scheduledFiles();
  assert.match(
    releaseGateFailure("lib", "major", [scheduledRule], files) ?? "",
    /lib 3\.4\.0 still ships legacy flag as major 3; raise its major in that rule, or drop the key, before a major release/,
  );
  const raised = {
    ...scheduledRule,
    packages: [{ ...scheduledRule.packages[0], major: 4 }],
  };
  assert.equal(releaseGateFailure("lib", "major", [raised], files), null);
  for (const mode of ["patch", "minor", "current", "rc-bump"]) {
    assert.equal(
      releaseGateFailure("lib", mode, [scheduledRule], files),
      null,
      mode,
    );
  }
});

test("every release workflow runs the scheduled removal gate for its package", () => {
  for (const [workflow, name] of Object.entries(releaseGates)) {
    const text = fs.readFileSync(
      path.join(repoRoot, ".github/workflows", workflow),
      "utf8",
    );
    const header = "\n  release-branch:\n";
    const job = text.indexOf(header);
    const gate = text.indexOf(
      `run: node scripts/scheduled-removals.mjs release-gate ${name} "$VERSION_TYPE"`,
    );
    assert.ok(job >= 0 && gate > job, workflow);
    // The gate's own job needs the tags, or a version=current retry reads as a first release.
    const steps = text.slice(job + header.length, gate);
    assert.doesNotMatch(steps, /\n {2}[\w-]+:\n/u, workflow);
    assert.match(steps, /fetch-depth: 0/u, workflow);
    const tag = releaseTagOf(name, "$");
    assert.ok(tag && text.includes(tag), `${workflow} cuts no ${tag} tag`);
  }
  const gated = new Set(Object.values(releaseGates));
  for (const rule of scheduledRemovalRules) {
    for (const pkg of rule.packages) {
      assert.ok(
        gated.has(pkg.name),
        `${rule.label}: ${pkg.name} has no release gate`,
      );
    }
  }
});

test("the release gate command passes a package that no rule names", () => {
  const output = execFileSync(
    "node",
    [
      path.join(repoRoot, "scripts/scheduled-removals.mjs"),
      "release-gate",
      "godot-iap",
      "patch",
    ],
    { encoding: "utf8" },
  );
  assert.match(output, /godot-iap may release with version=patch/);
});
