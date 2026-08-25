import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATEGORY_RULES,
  ISSUE_SOURCES,
  candidateCategories,
  isIssue,
  toRecord,
} from "./mine-iap-issues.mjs";

test("source inventory covers every SDK archive plus the monorepo", () => {
  const libraries = ISSUE_SOURCES.map((source) => source.library);
  for (const expected of [
    "react-native-iap",
    "expo-iap",
    "flutter_inapp_purchase",
    "kmp-iap",
    "godot-iap",
    "openiap-monorepo",
  ]) {
    assert.ok(libraries.includes(expected), expected);
  }
  assert.equal(
    new Set(ISSUE_SOURCES.map((source) => source.repo)).size,
    ISSUE_SOURCES.length,
  );
});

test("category rules use unique category names", () => {
  const names = CATEGORY_RULES.map((rule) => rule.category);
  assert.equal(new Set(names).size, names.length);
});

test("keyword seeding matches obvious failure classes", () => {
  assert.deepEqual(
    candidateCategories({ title: "Receipt validation fails on iOS 17" }),
    ["receipt-validation"],
  );
  assert.ok(
    candidateCategories({
      title: "Crash after Billing Client 6 migration",
    }).includes("store-api-churn"),
  );
  assert.ok(
    candidateCategories({
      title: "purchase stuck",
      labels: [{ name: "pending purchase" }],
    }).includes("pending-or-deferred"),
  );
  assert.deepEqual(candidateCategories({ title: "Question about roadmap" }), [
    "unclassified",
  ]);
});

test("pull requests are excluded from the issue stream", () => {
  assert.equal(isIssue({ number: 1 }), true);
  assert.equal(isIssue({ number: 2, pull_request: { url: "x" } }), false);
});

test("records stay bounded and stable for hand classification", () => {
  const record = toRecord("react-native-iap", {
    number: 42,
    title: "restore purchases returns empty",
    state: "closed",
    labels: [{ name: "bug" }, "ios"],
    created_at: "2024-01-01T00:00:00Z",
    closed_at: "2024-02-01T00:00:00Z",
    comments: 7,
    html_url: "https://github.com/hyochan/react-native-iap/issues/42",
    body: "x".repeat(10_000),
  });
  assert.equal(record.body.length, 4000);
  assert.deepEqual(record.labels, ["bug", "ios"]);
  assert.ok(record.candidateCategories.includes("restore-entitlement"));
});
