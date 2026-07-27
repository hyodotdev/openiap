import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  activeDocsForbiddenTokens,
  collectForbiddenMatches,
  collectMissingRequiredTexts,
  collectRepositorySchemaDeprecations,
  completedRemovalRules,
} from "./audit-deprecation-schedule.mjs";

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

test("repository schema has no completed-train deprecations", () => {
  const deprecations = collectRepositorySchemaDeprecations();
  assert.deepEqual(deprecations.issues, []);
  assert.deepEqual(deprecations.entries, []);
});
