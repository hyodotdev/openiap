import { describe, expect, it, vi } from "vitest";

import {
  ingestGoogleRtdn as registeredIngestGoogleRtdn,
  selectLongestDatedLineItem,
  selectSubscriptionMoney,
} from "./google";
import { testableFunction } from "../test.setup";

const ingestGoogleRtdn = testableFunction(registeredIngestGoogleRtdn);

describe("selectLongestDatedLineItem", () => {
  it("selects the line item whose product owns the latest entitlement", () => {
    expect(
      selectLongestDatedLineItem([
        { productId: "base", expiryTime: "2026-09-01T00:00:00Z" },
        { productId: "addon", expiryTime: "2026-10-01T00:00:00Z" },
      ]),
    ).toMatchObject({ productId: "addon" });
  });

  it("falls back to the first item when every expiry is absent or invalid", () => {
    expect(
      selectLongestDatedLineItem([
        { productId: "first", expiryTime: "invalid" },
        { productId: "second" },
      ]),
    ).toMatchObject({ productId: "first" });
  });
});

describe("selectSubscriptionMoney", () => {
  const plan = {
    recurringPrice: { currencyCode: "USD", units: "9" },
    priceChangeDetails: {
      newPrice: { currencyCode: "USD", units: "12" },
    },
  };

  it("uses the announced price for price-change notifications", () => {
    expect(selectSubscriptionMoney(plan, 19)).toMatchObject({ units: "12" });
  });

  it("uses the current recurring price for lifecycle notifications", () => {
    expect(selectSubscriptionMoney(plan, 2)).toMatchObject({ units: "9" });
  });

  it("does not mislabel the current price when change details are absent", () => {
    expect(
      selectSubscriptionMoney({ recurringPrice: plan.recurringPrice }, 19),
    ).toBeUndefined();
  });
});

describe("ingestGoogleRtdn preflight", () => {
  it("repairs subscription state after an event-first partial failure", async () => {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_a",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      // No Play service account: the first attempt still records and applies
      // the type-derived event without enrichment.
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: "project_a",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce({
        eventId: "event_existing",
        type: "SubscriptionRenewed",
        purchaseToken: "purchase_token",
      });
    const runAction = vi.fn();
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_existing", deduped: false })
      // Simulate a crash after webhookEvents commits but before subscriptions.
      .mockRejectedValueOnce(new Error("subscription write failed"))
      .mockResolvedValueOnce({ transition: "renewed", active: true });

    const input = {
      apiKey: "test_key",
      rawMessage: "raw",
      payload: {
        messageId: "message_existing",
        packageName: "dev.openiap.test",
        eventTimeMillis: 1_000,
        subscriptionNotification: {
          notificationType: 2,
          purchaseToken: "purchase_token",
        },
      },
    };

    await expect(
      ingestGoogleRtdn._handler({ runAction, runMutation, runQuery }, input),
    ).rejects.toThrow("subscription write failed");

    const result = await ingestGoogleRtdn._handler(
      { runAction, runMutation, runQuery },
      input,
    );

    expect(result).toEqual({
      eventId: "event_existing",
      type: "SubscriptionRenewed",
      deduped: true,
    });
    expect(runQuery).toHaveBeenCalledTimes(5);
    expect(runQuery.mock.calls[4]?.[1]).toEqual({
      projectId: "project_a",
      source: "google",
      sourceNotificationId: "message_existing",
    });
    expect(runAction).not.toHaveBeenCalled();
    expect(runMutation).toHaveBeenCalledTimes(3);
    expect(runMutation.mock.calls[2]?.[1]).toEqual({
      projectId: "project_a",
      eventId: "event_existing",
    });
  });
});
