import { describe, expect, it, vi } from "vitest";

import { ingestGoogleRtdn as registeredIngestGoogleRtdn } from "./google";
import { testableFunction } from "../test.setup";

const ingestGoogleRtdn = testableFunction(registeredIngestGoogleRtdn);

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
        platform: "Android",
        purchaseToken: "purchase_token",
        productId: "premium_monthly",
        subscriptionState: "Active",
        expiresAt: 2_000,
        renewsAt: 2_000,
        currency: "USD",
        priceAmountMicros: 9_990_000,
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
          subscriptionId: "premium_monthly",
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
      type: "WebhookEvent",
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
      event: {
        type: "SubscriptionRenewed",
        productId: "premium_monthly",
        subscriptionState: "Active",
        expiresAt: 2_000,
        renewsAt: 2_000,
        cancellationReason: undefined,
        currency: "USD",
        priceAmountMicros: 9_990_000,
        platform: "Android",
        purchaseToken: "purchase_token",
      },
    });
  });
});
