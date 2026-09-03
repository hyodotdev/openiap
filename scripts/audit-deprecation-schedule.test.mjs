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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

  const specMajor = Number(
    JSON.parse(
      fs.readFileSync(path.join(repoRoot, "openiap-versions.json"), "utf8"),
    ).spec.split(".")[0],
  );
  for (const entry of deprecations.entries) {
    const removalMajor = Number(/OpenIAP (\d+)\.\d+\.$/.exec(entry.reason)?.[1]);
    assert.ok(
      Number.isFinite(removalMajor),
      `${entry.ownerPath} must name its removal train`,
    );
    assert.ok(
      removalMajor > specMajor,
      `${entry.ownerPath} is overdue: scheduled for OpenIAP ${removalMajor}, spec is ${specMajor}`,
    );
  }
});

test("overdue schema deprecations are reported as failures", () => {
  const overdue = extractSchemaDeprecations([
    {
      sourceId: "overdue.graphql",
      sdl: `type Query {
  old: String @deprecated(reason: "Use current. Scheduled for removal in OpenIAP 1.0.")
}`,
    },
  ]);
  assert.equal(overdue.entries.length, 1);
  assert.match(overdue.entries[0].reason, /OpenIAP 1\.0\.$/);
  assert.match(
    collectSchemaDeprecationFailures(overdue, "2.0.0")[0],
    /is due for removal in OpenIAP 1 \(spec is 2\)/,
  );
});

test("schema deprecation audit rejects malformed spec versions", () => {
  assert.deepEqual(
    collectSchemaDeprecationFailures({ entries: [], issues: [] }, "not-semver"),
    ["openiap-versions.json: Invalid OpenIAP Spec version: 'not-semver'"],
  );
});
