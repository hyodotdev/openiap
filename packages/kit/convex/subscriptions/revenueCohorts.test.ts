import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";
import {
  accessEndsAt,
  addSubscriptionToCohorts,
  type CohortBucket,
} from "./revenueCohorts";

const AS_OF = Date.parse("2026-03-15T12:00:00Z");
const PRICE = 9_990_000;
const at = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

function sub(
  partial: Partial<Doc<"subscriptions">> & Pick<Doc<"subscriptions">, "state">,
): Doc<"subscriptions"> {
  return {
    _id: "subscriptions_1" as Id<"subscriptions">,
    _creationTime: 0,
    projectId: "projects_1" as Id<"projects">,
    purchaseToken: "token",
    productKind: "subscription",
    productId: "premium_monthly",
    platform: "Android",
    currency: "USD",
    startedAt: at("2026-01-01"),
    updatedAt: at("2026-03-01"),
    lastEventId: "webhookEvents_1" as Id<"webhookEvents">,
    ...partial,
  };
}

function paidFacts(
  firstPaidAt: number,
  paidMicros: number,
  extra: Partial<NonNullable<Doc<"subscriptions">["analytics"]>> = {},
): NonNullable<Doc<"subscriptions">["analytics"]> {
  return {
    firstPaidAt,
    firstPaidEventType: "SubscriptionStarted",
    currency: "USD",
    paidMicros,
    refundedMicros: 0,
    ...extra,
  };
}

function cohorts(rows: Array<Doc<"subscriptions">>): Map<string, CohortBucket> {
  const buckets = new Map<string, CohortBucket>();
  for (const row of rows) addSubscriptionToCohorts(buckets, row, AS_OF);
  return buckets;
}

describe("addSubscriptionToCohorts", () => {
  const fixture = [
    // Direct start in January, still paying: retained every month.
    sub({
      state: "Active",
      expiresAt: at("2026-04-10"),
      analytics: paidFacts(at("2026-01-10"), 3 * PRICE),
    }),
    // Trial in January, converted, then canceled: retained until its paid
    // period ended on February 12.
    sub({
      state: "Expired",
      willRenew: false,
      expiresAt: at("2026-02-12"),
      analytics: paidFacts(at("2026-01-12"), PRICE, {
        trialStartedAt: at("2026-01-05"),
        firstPaidEventType: "SubscriptionRenewed",
      }),
    }),
    // A January trial that never converted.
    sub({
      state: "Expired",
      expiresAt: at("2026-01-27"),
      analytics: {
        trialStartedAt: at("2026-01-20"),
        paidMicros: 0,
        refundedMicros: 0,
      },
    }),
    // A March trial still running.
    sub({
      state: "Active",
      expiresAt: at("2026-03-17"),
      analytics: {
        trialStartedAt: at("2026-03-10"),
        paidMicros: 0,
        refundedMicros: 0,
      },
    }),
    // First observed charge was a renewal: its start month is unknown.
    sub({
      state: "Active",
      expiresAt: at("2026-04-01"),
      analytics: paidFacts(at("2026-01-02"), PRICE, {
        firstPaidEventType: "SubscriptionRenewed",
      }),
    }),
    // February start refunded on February 15.
    sub({
      state: "Refunded",
      expiresAt: at("2026-03-01"),
      lastEventOccurredAt: at("2026-02-15"),
      analytics: paidFacts(at("2026-02-01"), PRICE, { refundedMicros: PRICE }),
    }),
    // Sandbox and another currency stay in their own cohorts.
    sub({
      state: "Active",
      environment: "Sandbox",
      expiresAt: at("2026-04-03"),
      analytics: paidFacts(at("2026-01-03"), PRICE),
    }),
    sub({
      state: "Active",
      currency: "EUR",
      expiresAt: at("2026-04-15"),
      analytics: paidFacts(at("2026-01-15"), 8_990_000, { currency: "EUR" }),
    }),
    // Amazon has no store price and stays out, as in the daily series.
    sub({
      state: "Active",
      store: "amazon",
      expiresAt: at("2026-04-15"),
      analytics: paidFacts(at("2026-01-15"), PRICE),
    }),
  ];

  it("builds paid cohorts, retention, realized revenue and trial cohorts", () => {
    const buckets = cohorts(fixture);

    expect(buckets.get("Production|2026-01|USD")).toEqual({
      environment: "Production",
      month: "2026-01",
      currency: "USD",
      members: 2,
      revenueMicros: 4 * PRICE,
      refundedMicros: 0,
      retained: [2, 1, 1],
      trialStarts: 2,
      trialConversions: 1,
      trialsPending: 0,
    });
    expect(buckets.get("Production|2026-02|USD")).toMatchObject({
      members: 1,
      revenueMicros: PRICE,
      refundedMicros: PRICE,
      retained: [0, 0],
    });
    expect(buckets.get("Production|2026-03|USD")).toMatchObject({
      members: 0,
      trialStarts: 1,
      trialsPending: 1,
      retained: [],
    });
    expect(buckets.get("Sandbox|2026-01|USD")).toMatchObject({ members: 1 });
    expect(buckets.get("Production|2026-01|EUR")).toMatchObject({
      members: 1,
      revenueMicros: 8_990_000,
    });
    expect(buckets.size).toBe(5);
  });

  it("leaves out cohorts older than 24 months", () => {
    const buckets = cohorts([
      sub({
        state: "Active",
        expiresAt: at("2026-04-01"),
        analytics: paidFacts(at("2024-03-01"), PRICE),
      }),
      sub({
        state: "Active",
        expiresAt: at("2026-04-01"),
        analytics: paidFacts(at("2024-04-01"), PRICE),
      }),
    ]);
    expect([...buckets.keys()]).toEqual(["Production|2024-04|USD"]);
    expect(buckets.get("Production|2024-04|USD")?.retained).toHaveLength(24);
  });
});

describe("accessEndsAt", () => {
  it("keeps a canceled subscription until its paid-through date", () => {
    expect(
      accessEndsAt(
        sub({ state: "Active", willRenew: false, expiresAt: at("2026-04-01") }),
      ),
    ).toBe(at("2026-04-01"));
  });

  it("ends a refunded subscription at the refund", () => {
    expect(
      accessEndsAt(
        sub({
          state: "Refunded",
          expiresAt: at("2026-04-01"),
          lastEventOccurredAt: at("2026-03-02"),
        }),
      ),
    ).toBe(at("2026-03-02"));
  });
});
