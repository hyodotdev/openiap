import { describe, expect, it, vi } from "vitest";

import { ingestGoogleRtdn as registeredIngestGoogleRtdn } from "./google";
import { testableFunction } from "../test.setup";

const ingestGoogleRtdn = testableFunction(registeredIngestGoogleRtdn);

describe("ingestGoogleRtdn preflight", () => {
  it("returns an existing event before Play enrichment or mutations", async () => {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_a",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce("event_existing");
    const runAction = vi.fn();
    const runMutation = vi.fn();

    const result = await ingestGoogleRtdn._handler(
      { runAction, runMutation, runQuery },
      {
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
      },
    );

    expect(result).toEqual({
      eventId: "event_existing",
      type: "WebhookEvent",
      deduped: true,
    });
    expect(runQuery).toHaveBeenCalledTimes(2);
    expect(runQuery.mock.calls[1]?.[1]).toEqual({
      projectId: "project_a",
      source: "google",
      sourceNotificationId: "message_existing",
    });
    expect(runAction).not.toHaveBeenCalled();
    expect(runMutation).not.toHaveBeenCalled();
  });
});
