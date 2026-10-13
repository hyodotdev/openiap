import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(
  new URL("../scripts/coverage-report.mjs", import.meta.url),
);

describe("coverage report", () => {
  const artifact = JSON.parse(
    execFileSync(process.execPath, [SCRIPT, "--json"], { encoding: "utf8" }),
  );

  // The full set per suite, so deleting one check cannot hide behind another suite.
  const SHARED = [
    "capabilities.declared-capabilities-match-the-matrix",
    "completion.finish-is-idempotent",
    "errors.store-codes-normalize-to-spec-error-codes",
    "errors.unrecognized-store-code-normalizes-to-unknown",
    "identifiers.purchase-carries-a-concrete-store",
    "identifiers.purchase-token-is-stable-across-reads",
    "products.fetch-returns-requested-skus",
    "provider.invalid-purchase-emits-error-once",
    "purchases.pending-purchase-is-not-delivered-as-purchased",
    "purchases.request-emits-purchase-updated-on-success",
    "restoration.available-purchases-returns-owned-items",
    "subscriptions.active-subscription-is-reported-active",
    "subscriptions.groups-keep-independent-identifiers",
    "subscriptions.pending-subscription-is-not-active",
    "subscriptions.unknown-state-subscription-is-not-active",
  ];
  const coveredIds = (name) =>
    artifact.behaviors
      .filter((row) => row.coveredBy.includes(name))
      .map((row) => row.id)
      .sort();

  it("reads every behavior the community provider suites check", () => {
    expect(coveredIds("android-community-provider")).toEqual(
      [
        ...SHARED,
        "android-provider.native-offer-code-redemption",
        "android-provider.offer-code-redemption",
        "android-provider.subscription-billing-issue",
      ].sort(),
    );
    expect(coveredIds("apple-community-provider")).toEqual(
      [
        ...SHARED,
        "apple-provider.offer-code-redemption",
        "apple-provider.subscription-billing-issue",
        "capabilities.unsupported-operations-degrade-predictably",
      ].sort(),
    );
  });

  it("binds every behavior to an implementation beyond the reference adapter", () => {
    const gaps = artifact.behaviors
      .filter(
        (row) => !row.coveredBy.some((name) => name !== "openiap-reference"),
      )
      .map((row) => row.id);
    expect(gaps).toEqual([]);
    expect(() =>
      execFileSync(process.execPath, [SCRIPT, "--check"], { stdio: "pipe" }),
    ).not.toThrow();
  });
});
