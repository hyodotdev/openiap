import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";
import {
  mergeAnalyticsFacts,
  nextAnalyticsFacts,
  paidStartKind,
  subscriptionEnvironment,
} from "./analyticsFacts";

const PRICE = 9_990_000;

function event(
  partial: Partial<Doc<"webhookEvents">> & Pick<Doc<"webhookEvents">, "type">,
): Doc<"webhookEvents"> {
  return {
    _id: "webhookEvents_1" as Id<"webhookEvents">,
    _creationTime: 0,
    projectId: "projects_1" as Id<"projects">,
    source: "AppleAppStoreServerNotificationsV2",
    platform: "IOS",
    environment: "Production",
    sourceNotificationId: "notification",
    productKind: "subscription",
    currency: "USD",
    priceAmountMicros: PRICE,
    occurredAt: 1_000,
    receivedAt: 1_000,
    ...partial,
  };
}

describe("nextAnalyticsFacts", () => {
  it("records a trial start without money", () => {
    expect(
      nextAnalyticsFacts(
        undefined,
        event({ type: "SubscriptionStarted", freeTrial: true }),
      ),
    ).toEqual({ trialStartedAt: 1_000, paidMicros: 0, refundedMicros: 0 });
  });

  it("adds paid charges and subtracts nothing for lifecycle-only events", () => {
    const started = nextAnalyticsFacts(
      undefined,
      event({ type: "SubscriptionStarted" }),
    );
    const recovered = nextAnalyticsFacts(
      started ?? undefined,
      event({
        _id: "webhookEvents_2" as Id<"webhookEvents">,
        type: "SubscriptionRecovered",
        occurredAt: 2_000,
      }),
    );
    expect(recovered).toMatchObject({
      firstPaidAt: 1_000,
      firstPaidEventType: "SubscriptionStarted",
      paidMicros: 2 * PRICE,
    });
    expect(
      nextAnalyticsFacts(
        recovered ?? undefined,
        event({ type: "SubscriptionCanceled", occurredAt: 3_000 }),
      ),
    ).toBeNull();
  });

  it("nets a refund against its reversal and ignores Family Sharing revokes", () => {
    const paid = nextAnalyticsFacts(
      undefined,
      event({ type: "SubscriptionStarted" }),
    );
    const refunded = nextAnalyticsFacts(
      paid ?? undefined,
      event({ type: "PurchaseRefunded", cancellationReason: "Refunded" }),
    );
    expect(refunded?.refundedMicros).toBe(PRICE);
    const reversed = nextAnalyticsFacts(
      refunded ?? undefined,
      event({ type: "SubscriptionStarted", refundReversal: true }),
    );
    expect(reversed).toMatchObject({ refundedMicros: 0, paidMicros: PRICE });
    expect(
      nextAnalyticsFacts(
        reversed ?? undefined,
        event({ type: "SubscriptionRevoked" }),
      ),
    ).toBeNull();
  });

  it("never mixes currencies", () => {
    const usd = nextAnalyticsFacts(
      undefined,
      event({ type: "SubscriptionStarted" }),
    );
    const eur = nextAnalyticsFacts(
      usd ?? undefined,
      event({
        type: "SubscriptionRenewed",
        currency: "EUR",
        occurredAt: 2_000,
      }),
    );
    // The charge is still observed; its money stays out of the USD total.
    expect(eur).toBeNull();
    expect(usd).toMatchObject({ currency: "USD", paidMicros: PRICE });
  });
});

describe("paidStartKind", () => {
  it.each([
    [{ paidMicros: 0, refundedMicros: 0 }, undefined],
    [
      {
        firstPaidAt: 2,
        firstPaidEventType: "SubscriptionStarted" as const,
        paidMicros: 0,
        refundedMicros: 0,
      },
      "direct",
    ],
    [
      {
        trialStartedAt: 1,
        firstPaidAt: 2,
        firstPaidEventType: "SubscriptionRenewed" as const,
        paidMicros: 0,
        refundedMicros: 0,
      },
      "trial_conversion",
    ],
    [
      {
        firstPaidAt: 2,
        firstPaidEventType: "SubscriptionRenewed" as const,
        paidMicros: 0,
        refundedMicros: 0,
      },
      undefined,
    ],
  ])("classifies %j as %s", (facts, expected) => {
    expect(paidStartKind(facts)).toBe(expected);
  });
});

describe("mergeAnalyticsFacts", () => {
  it("keeps the earliest facts and sums money in one currency", () => {
    expect(
      mergeAnalyticsFacts(
        {
          firstPaidAt: 5,
          firstPaidEventType: "SubscriptionRenewed",
          currency: "USD",
          paidMicros: PRICE,
          refundedMicros: 0,
        },
        {
          trialStartedAt: 1,
          firstPaidAt: 2,
          firstPaidEventType: "SubscriptionRenewed",
          currency: "USD",
          paidMicros: PRICE,
          refundedMicros: PRICE,
        },
      ),
    ).toEqual({
      trialStartedAt: 1,
      firstPaidAt: 2,
      firstPaidEventType: "SubscriptionRenewed",
      currency: "USD",
      paidMicros: 2 * PRICE,
      refundedMicros: PRICE,
    });
  });
});

describe("subscriptionEnvironment", () => {
  it("reads the row, then its last store event, then defaults to production", () => {
    expect(subscriptionEnvironment({ environment: "Xcode" })).toBe("Sandbox");
    expect(
      subscriptionEnvironment({ lastEventSource: { environment: "Sandbox" } }),
    ).toBe("Sandbox");
    expect(subscriptionEnvironment({})).toBe("Production");
  });
});
