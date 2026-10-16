import {
  Environment,
  NotificationTypeV2,
  SignedDataVerifier,
} from "@apple/app-store-server-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ingestAppleAsnIOS as registeredIngest,
  mapPreviewEnvironment,
} from "./apple";
import { testableFunction } from "../test.setup";

afterEach(() => vi.restoreAllMocks());

// The environment is read from the notification before its signature is
// checked, so it decides whether the signature is checked at all: the Apple
// library returns the decoded JWT unverified under XCODE and LOCAL_TESTING.
// Anything a caller can put in the payload must still require a real signature.
describe("mapPreviewEnvironment", () => {
  it("maps the two environments Apple signs", () => {
    expect(mapPreviewEnvironment("Sandbox")).toBe(Environment.SANDBOX);
    expect(mapPreviewEnvironment("Production")).toBe(Environment.PRODUCTION);
  });

  it.each(["Xcode", "LocalTesting", "XCODE", undefined, "", "anything"])(
    "never selects an unverified environment for %s",
    (claimed) => {
      const resolved = mapPreviewEnvironment(claimed);
      expect(resolved).not.toBe(Environment.XCODE);
      expect(resolved).not.toBe(Environment.LOCAL_TESTING);
    },
  );
});

describe("Apple notification evidence dates", () => {
  it.each([NotificationTypeV2.DID_RENEW, NotificationTypeV2.REFUND])(
    "preserves transaction dates through %s ingestion",
    async (notificationType) => {
      const purchaseDate = Date.parse("2026-01-01T00:00:00Z");
      const revocationDate = Date.parse("2026-01-20T00:00:00Z");
      const signedDate = Date.parse("2026-01-21T00:00:00Z");
      const jws = (value: unknown) =>
        `e30.${Buffer.from(JSON.stringify(value)).toString("base64url")}.fixture`;
      const payload = {
        notificationType,
        notificationUUID: `fixture_${notificationType}`,
        signedDate,
        data: {
          environment: Environment.SANDBOX,
          bundleId: "dev.openiap.test",
          signedTransactionInfo: jws({
            originalTransactionId: "original_fixture",
            transactionId: "transaction_fixture",
            type: "Auto-Renewable Subscription",
            productId: "premium",
            purchaseDate,
            expiresDate: Date.parse("2026-02-01T00:00:00Z"),
            ...(notificationType === NotificationTypeV2.REFUND
              ? { revocationDate }
              : {}),
          }),
        },
      };
      vi.spyOn(
        SignedDataVerifier.prototype,
        "verifyAndDecodeNotification",
      ).mockResolvedValue(payload);
      const runMutation = vi
        .fn()
        .mockResolvedValueOnce({ eventId: "event_fixture", deduped: false })
        .mockResolvedValueOnce({ active: true });

      await testableFunction(registeredIngest)._handler(
        {
          runQuery: vi.fn().mockResolvedValue({
            _id: "project_fixture",
            iosBundleId: "dev.openiap.test",
            iosAppAppleId: 123,
            iosAppStoreIssuerId: "fixture_issuer",
            iosAppStoreKeyId: "fixture_key",
          }),
          runMutation,
        },
        { apiKey: "fixture_key", signedPayload: jws(payload) },
      );

      expect(runMutation.mock.calls[0]?.[1]?.event).toMatchObject({
        purchaseDate,
        occurredAt: signedDate,
        ...(notificationType === NotificationTypeV2.REFUND
          ? { revocationDate }
          : {}),
      });
    },
  );
});
