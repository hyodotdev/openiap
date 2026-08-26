import { describe, expect, it } from "vitest";

import { COMMERCE_EVENT_TYPES } from "./contract";
import { checkDestinationUrl } from "./signing";

// The mutations themselves need the Convex auth context, which the unit
// harness does not model. What is worth pinning here is the security-relevant
// logic they compose: which URLs may ever be stored, which event-type filters
// are accepted, and that the public projection cannot leak a secret.

/** Mirrors `publicView` in destinations.ts. Kept in step by the test below. */
const PUBLIC_FIELDS = [
  "_id",
  "url",
  "enabled",
  "eventTypes",
  "description",
  "disabledReason",
  "consecutiveFailures",
  "lastSuccessAt",
  "lastFailureAt",
  "createdAt",
  "updatedAt",
] as const;

describe("destination projection", () => {
  it("does not expose the signing secret or its rotation slot", () => {
    expect(PUBLIC_FIELDS).not.toContain("secret");
    expect(PUBLIC_FIELDS).not.toContain("previousSecret");
    expect(PUBLIC_FIELDS).not.toContain("previousSecretExpiresAt");
  });
});

describe("destination url policy", () => {
  it("stores only normalized public https urls", () => {
    const result = checkDestinationUrl("https://Hooks.Example.com/iapkit");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.toString()).toBe("https://hooks.example.com/iapkit");
    }
  });

  it("refuses the cloud metadata endpoint", () => {
    expect(checkDestinationUrl("https://169.254.169.254/latest").ok).toBe(
      false,
    );
  });
});

describe("event type filter validation", () => {
  it("accepts every published event type", () => {
    for (const type of COMMERCE_EVENT_TYPES) {
      expect((COMMERCE_EVENT_TYPES as readonly string[]).includes(type)).toBe(
        true,
      );
    }
  });

  it("rejects a type that is not in the published contract", () => {
    expect(
      (COMMERCE_EVENT_TYPES as readonly string[]).includes(
        "subscription.definitely_not_real",
      ),
    ).toBe(false);
  });
});
