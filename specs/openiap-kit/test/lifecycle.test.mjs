// Checks the two normative rules the vectors encode: which states grant access,
// and that the expiry boundary is exclusive.
//
// What remains deliberately restates two normative SPEC.md rules — which states
// grant access, and that the expiry boundary is exclusive — so a silent change
// to the generator is caught here rather than shipped. Coverage checks were
// removed: `--check` proves the vectors are the generator's output before these
// run, so anything derived from its loop structure could never fail.
//
// What this file cannot do is prove the vectors describe a real implementation:
// re-deriving the generator's own expression would pass by construction. That
// check lives in `packages/kit`, which runs the vectors against a state machine
// and an emitter written without reference to them.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const vectors = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../generated/vectors/lifecycle.json", import.meta.url),
    ),
    "utf8",
  ),
);

describe("entitlement vectors", () => {
  it("grants access in exactly two states", () => {
    const granting = new Set(
      vectors.entitlement.cases.filter((c) => c.entitled).map((c) => c.state),
    );
    expect([...granting].sort()).toEqual(["Active", "InGracePeriod"]);
  });

  it("never grants access at or past the expiry instant", () => {
    for (const c of vectors.entitlement.cases) {
      if (c.expiresAt !== undefined && c.processedAt >= c.expiresAt) {
        expect(c.entitled, c.name).toBe(false);
      }
    }
  });

  it("represents an unknown expiry by omission, never wire-invalid null", () => {
    expect(vectors.entitlement.cases.some((c) => !("expiresAt" in c))).toBe(
      true,
    );
    expect(vectors.entitlement.cases.some((c) => c.expiresAt === null)).toBe(
      false,
    );
  });

  it("pins processedAt as the entitlement evaluation instant", () => {
    const delayed = vectors.entitlement.cases.find(
      (c) =>
        c.state === "Active" &&
        c.occurredAt < c.expiresAt &&
        c.expiresAt <= c.processedAt,
    );
    expect(delayed).toBeDefined();
    expect(delayed.entitled).toBe(false);
  });
});

describe("emission vectors", () => {
  it("states the bound-target precondition for entitlement deltas", () => {
    expect(vectors.emission.precondition).toContain(
      "bound userId and productId",
    );
  });

  it("names no implementation's internal transition vocabulary", () => {
    const raw = JSON.stringify(vectors);
    for (const internal of [
      "Started",
      "Renewed",
      "Ignored",
      "EnteredGracePeriod",
    ]) {
      expect(raw).not.toContain(`"${internal}"`);
    }
  });
});

describe("first-binding vectors", () => {
  it("emits one grant exactly when the gate is current at binding", () => {
    for (const testCase of vectors.binding.cases) {
      expect(testCase.emit, testCase.name).toEqual(
        testCase.entitledAtBinding ? ["entitlement.granted"] : [],
      );
    }
  });

  it.each([
    "bind while the first grant is current",
    "bind after an unbound gate reopened",
  ])("pins the current grant case independently: %s", (name) => {
    const testCase = vectors.binding.cases.find((entry) => entry.name === name);
    expect(testCase).toBeDefined();
    expect(testCase.entitledAtBinding).toBe(true);
    expect(testCase.emit).toEqual(["entitlement.granted"]);
  });

  it.each([
    "bind after the unbound grant expired",
    "bind after an unbound grant was revoked",
  ])("never replays the obsolete grant: %s", (name) => {
    const testCase = vectors.binding.cases.find((entry) => entry.name === name);
    expect(testCase).toBeDefined();
    expect(testCase.unboundGateChanges).toContain("entitlement.granted");
    expect(testCase.entitledAtBinding).toBe(false);
    expect(testCase.emit).toEqual([]);
  });
});
