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

  it("counts a Play refund from its voided purchase, never from the revocation", () => {
    const paid = nextAnalyticsFacts(
      undefined,
      event({ type: "SubscriptionStarted", platform: "Android" }),
    );
    expect(
      nextAnalyticsFacts(
        paid ?? undefined,
        event({
          type: "SubscriptionRevoked",
          platform: "Android",
          cancellationReason: "Refunded",
        }),
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

  it("treats a Google replacement as a plan change, not a start or a charge", () => {
    const trial = nextAnalyticsFacts(
      undefined,
      event({
        type: "SubscriptionStarted",
        platform: "Android",
        freeTrial: true,
      }),
    );
    for (const freeTrial of [false, true]) {
      expect(
        nextAnalyticsFacts(
          trial ?? undefined,
          event({
            type: "SubscriptionStarted",
            platform: "Android",
            freeTrial,
            linkedPurchaseToken: "replaced-token",
            occurredAt: 2_000,
          }),
        ),
      ).toBeNull();
    }
    // The trial still converts on the first charge after the change.
    expect(trial).toEqual({
      trialStartedAt: 1_000,
      paidMicros: 0,
      refundedMicros: 0,
    });
  });

  it("adds a replacement Play charged at once to the money, not the cohort start", () => {
    const paid = nextAnalyticsFacts(
      undefined,
      event({ type: "SubscriptionStarted", platform: "Android" }),
    );
    expect(
      nextAnalyticsFacts(
        paid ?? undefined,
        event({
          _id: "webhookEvents_2" as Id<"webhookEvents">,
          type: "SubscriptionStarted",
          platform: "Android",
          linkedPurchaseToken: "replaced-token",
          replacementCharged: true,
          occurredAt: 500,
        }),
      ),
    ).toEqual({ ...paid, paidMicros: 2 * PRICE });
  });

  it("records no trial that starts after the first paid charge, in either order", () => {
    const paid = event({
      _id: "webhookEvents_2" as Id<"webhookEvents">,
      type: "SubscriptionStarted",
      occurredAt: 2_000,
    });
    const laterTrial = event({
      type: "SubscriptionStarted",
      freeTrial: true,
      occurredAt: 3_000,
    });
    const expected = {
      firstPaidAt: 2_000,
      firstPaidEventId: "webhookEvents_2",
      firstPaidEventType: "SubscriptionStarted",
      currency: "USD",
      paidMicros: PRICE,
      refundedMicros: 0,
    };
    const paidFirst = nextAnalyticsFacts(undefined, paid) ?? undefined;
    expect(nextAnalyticsFacts(paidFirst, laterTrial)).toBeNull();
    expect(paidFirst).toEqual(expected);
    const trialFirst = nextAnalyticsFacts(undefined, laterTrial) ?? undefined;
    expect(nextAnalyticsFacts(trialFirst, paid)).toEqual(expected);
    expect(
      mergeAnalyticsFacts(
        { trialStartedAt: 3_000, paidMicros: 0, refundedMicros: 0 },
        paidFirst,
      ),
    ).toEqual(expected);
  });

  it("records a resubscribe as the first charge, never as a trial start", () => {
    const resubscribe = event({
      type: "SubscriptionStarted",
      resubscribe: true,
    });
    expect(nextAnalyticsFacts(undefined, resubscribe)).toEqual({
      firstPaidAt: 1_000,
      firstPaidEventId: "webhookEvents_1",
      firstPaidEventType: "SubscriptionStarted",
      firstPaidResubscribe: true,
      currency: "USD",
      paidMicros: PRICE,
      refundedMicros: 0,
    });
    expect(
      nextAnalyticsFacts(undefined, { ...resubscribe, freeTrial: true }),
    ).toBeNull();
    // An earlier start replaces it as the first charge.
    expect(
      nextAnalyticsFacts(
        nextAnalyticsFacts(undefined, resubscribe) ?? undefined,
        event({
          _id: "webhookEvents_0" as Id<"webhookEvents">,
          type: "SubscriptionStarted",
          occurredAt: 500,
        }),
      ),
    ).not.toHaveProperty("firstPaidResubscribe");
  });

  it("makes a resubscribe after a lapsed trial the direct start, in either order", () => {
    const trial = event({
      _id: "webhookEvents_0" as Id<"webhookEvents">,
      type: "SubscriptionStarted",
      freeTrial: true,
      occurredAt: 500,
    });
    const resubscribe = event({
      type: "SubscriptionStarted",
      resubscribe: true,
    });
    const trialFirst = nextAnalyticsFacts(
      nextAnalyticsFacts(undefined, trial) ?? undefined,
      resubscribe,
    );
    const resubscribeFirst = nextAnalyticsFacts(
      nextAnalyticsFacts(undefined, resubscribe) ?? undefined,
      trial,
    );
    expect(resubscribeFirst).toEqual(trialFirst);
    expect(paidStartKind(trialFirst ?? undefined)).toBe("direct");
    expect(
      paidStartKind(nextAnalyticsFacts(undefined, resubscribe) ?? undefined),
    ).toBeUndefined();
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
    // Apple resubscribe after a lapsed trial: a new paid start, not the
    // renewal that ends a trial.
    [
      {
        trialStartedAt: 1,
        firstPaidAt: 50,
        firstPaidEventType: "SubscriptionStarted" as const,
        firstPaidResubscribe: true,
        paidMicros: 0,
        refundedMicros: 0,
      },
      "direct",
    ],
    // A resubscribe with no trial before it: the subscription started paying
    // before IAPKit saw it.
    [
      {
        firstPaidAt: 50,
        firstPaidEventType: "SubscriptionStarted" as const,
        firstPaidResubscribe: true,
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

  it("keeps the resubscribe mark with the first paid charge", () => {
    const resubscribed = {
      firstPaidAt: 2,
      firstPaidEventType: "SubscriptionStarted" as const,
      firstPaidResubscribe: true,
      paidMicros: PRICE,
      refundedMicros: 0,
    };
    const later = {
      firstPaidAt: 5,
      firstPaidEventType: "SubscriptionStarted" as const,
      paidMicros: PRICE,
      refundedMicros: 0,
    };
    expect(mergeAnalyticsFacts(later, resubscribed)).toMatchObject({
      firstPaidAt: 2,
      firstPaidResubscribe: true,
    });
    expect(
      mergeAnalyticsFacts(resubscribed, { ...later, firstPaidAt: 1 }),
    ).not.toHaveProperty("firstPaidResubscribe");
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
