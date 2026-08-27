import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const playMocks = vi.hoisted(() => ({ subscriptionsGet: vi.fn() }));
const oidcMocks = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class OAuth2Client {
    verifyIdToken = oidcMocks.verifyIdToken;
  },
}));
vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: class GoogleAuth {} },
    androidpublisher: () => ({
      purchases: { subscriptionsv2: { get: playMocks.subscriptionsGet } },
    }),
  },
}));

import {
  ingestGoogleRtdn as registeredIngestGoogleRtdn,
  projectPubSubOidcAudiences,
  selectLongestDatedLineItem,
  selectSubscriptionMoney,
  verifyPubSubOidcPrincipal,
} from "./google";
import { testableFunction } from "../test.setup";

const ingestGoogleRtdn = testableFunction(registeredIngestGoogleRtdn);
const serviceAccountContent = JSON.stringify({
  client_email: "pubsub@project.iam.gserviceaccount.com",
});
const originalAllowUnauthenticatedPubSub =
  process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
const originalAppEnv = process.env.APP_ENV;

beforeAll(() => {
  process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
  process.env.APP_ENV = "test";
});

afterAll(() => {
  if (originalAllowUnauthenticatedPubSub === undefined) {
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
  } else {
    process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB =
      originalAllowUnauthenticatedPubSub;
  }
  if (originalAppEnv === undefined) {
    delete (process.env as Record<string, string | undefined>).APP_ENV;
  } else {
    process.env.APP_ENV = originalAppEnv;
  }
});

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
  it("rejects a direct Convex call without Pub/Sub OIDC", async () => {
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
    const runAction = vi.fn();
    const runMutation = vi.fn();
    const runQuery = vi.fn().mockResolvedValueOnce({
      _id: "project_a",
      androidPackageName: "dev.openiap.test",
    });

    try {
      await expect(
        ingestGoogleRtdn._handler(
          { runAction, runMutation, runQuery },
          {
            apiKey: "test_key",
            rawMessage: "raw",
            payload: {
              messageId: "forged_terminal_event",
              packageName: "dev.openiap.test",
              eventTimeMillis: 1_000,
              subscriptionNotification: {
                notificationType: 13,
                purchaseToken: "purchase_token",
              },
            },
          },
        ),
      ).rejects.toThrow("OIDC authentication failed");
      expect(runAction).not.toHaveBeenCalled();
      expect(runMutation).not.toHaveBeenCalled();
      expect(runQuery).toHaveBeenCalledTimes(1);
    } finally {
      process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
    }
  });

  it("ignores the unauthenticated bypass flag in production", async () => {
    process.env.APP_ENV = "production";
    const runQuery = vi.fn().mockResolvedValueOnce({
      _id: "project_production",
      androidPackageName: "dev.openiap.test",
    });

    try {
      await expect(
        ingestGoogleRtdn._handler(
          { runAction: vi.fn(), runMutation: vi.fn(), runQuery },
          {
            apiKey: "test_key",
            rawMessage: "raw",
            payload: {
              messageId: "forged_production_event",
              packageName: "dev.openiap.test",
              eventTimeMillis: 1_000,
              testNotification: { version: "1.0" },
            },
          },
        ),
      ).rejects.toThrow("OIDC authentication failed");
      expect(runQuery).toHaveBeenCalledTimes(1);
    } finally {
      process.env.APP_ENV = "test";
    }
  });

  it("rejects malformed Pub/Sub OIDC claims and bounded inputs", async () => {
    const audience = ["https://kit.openiap.dev/v1/webhooks/iap_public"];
    const verify = vi.fn();

    await expect(
      verifyPubSubOidcPrincipal("x".repeat(16 * 1024 + 1), audience, verify),
    ).rejects.toThrow("OIDC authentication failed");
    await expect(
      verifyPubSubOidcPrincipal("signed-token", Array(9).fill("aud"), verify),
    ).rejects.toThrow("OIDC authentication failed");
    expect(verify).not.toHaveBeenCalled();

    await expect(
      verifyPubSubOidcPrincipal("signed-token", audience, async () => {
        throw new Error("invalid signature");
      }),
    ).rejects.toThrow("OIDC authentication failed");
    await expect(
      verifyPubSubOidcPrincipal("signed-token", audience, async () => ({
        email: "pubsub@project.iam.gserviceaccount.com",
        email_verified: false,
      })),
    ).rejects.toThrow("OIDC authentication failed");
  });

  it("derives the Convex audience from the project endpoint", () => {
    const audiences = projectPubSubOidcAudiences("openiap-kit_pk_project", {
      IAPKIT_PUBLIC_BASE_URL: "https://self-hosted.example",
      GOOGLE_PUBSUB_PUSH_AUDIENCE: "https://self-hosted.example/",
    });
    expect(audiences).toHaveLength(2);
    expect(audiences).toContain(
      "https://self-hosted.example/v1/webhooks/openiap-kit_pk_project",
    );
    expect(audiences).not.toContain("https://self-hosted.example/");
    expect(audiences).not.toContain(
      "https://self-hosted.example/v1/webhooks/openiap-kit_pk_other",
    );
    expect(audiences).not.toContain(
      "https://other.example/v1/webhooks/openiap-kit_pk_project",
    );
    expect(audiences).not.toContain(
      "https://self-hosted.example/v1/webhooks/openiap-kit_pk_project?admin=1",
    );
    expect(
      projectPubSubOidcAudiences("openiap-kit_pk_project", {
        IAPKIT_PUBLIC_BASE_URL: "https://self-hosted.example",
        GOOGLE_PUBSUB_PUSH_AUDIENCE: "https://other.example/",
      }),
    ).toEqual([]);
  });

  it("refreshes the project principal when the uploaded file changes", async () => {
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_auth_rotation",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce({ _id: "service_account_old" })
      .mockResolvedValueOnce({
        eventId: "event_old",
        type: "SubscriptionExpired",
        purchaseToken: "old_token",
      })
      .mockResolvedValueOnce({
        _id: "project_auth_rotation",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce({ _id: "service_account_new" })
      .mockResolvedValueOnce({
        eventId: "event_new",
        type: "SubscriptionExpired",
        purchaseToken: "new_token",
      });
    const runAction = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          client_email: "old@project.iam.gserviceaccount.com",
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          client_email: "new@project.iam.gserviceaccount.com",
        }),
      });
    const runMutation = vi.fn().mockResolvedValue(null);
    oidcMocks.verifyIdToken
      .mockResolvedValueOnce({
        getPayload: () => ({
          email: "old@project.iam.gserviceaccount.com",
          email_verified: true,
        }),
      })
      .mockResolvedValueOnce({
        getPayload: () => ({
          email: "new@project.iam.gserviceaccount.com",
          email_verified: true,
        }),
      });
    const args = {
      apiKey: "openiap-kit_pk_project",
      oidcToken: "signed-token",
      rawMessage: "raw",
      payload: {
        messageId: "redelivery",
        packageName: "dev.openiap.test",
        eventTimeMillis: 1_000,
        subscriptionNotification: {
          notificationType: 13,
          purchaseToken: "purchase_token",
        },
      },
    };

    try {
      await expect(
        ingestGoogleRtdn._handler({ runAction, runMutation, runQuery }, args),
      ).resolves.toMatchObject({ eventId: "event_old", deduped: true });
      await expect(
        ingestGoogleRtdn._handler({ runAction, runMutation, runQuery }, args),
      ).resolves.toMatchObject({ eventId: "event_new", deduped: true });
      expect(runAction).toHaveBeenCalledTimes(2);
      expect(oidcMocks.verifyIdToken).toHaveBeenCalledTimes(2);
    } finally {
      process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
    }
  });

  it("invalidates the project principal when the uploaded file is removed", async () => {
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_auth_removal",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce({ _id: "service_account_removal" })
      .mockResolvedValueOnce({
        eventId: "event_before_removal",
        type: "SubscriptionExpired",
        purchaseToken: "purchase_token",
      })
      .mockResolvedValueOnce({
        _id: "project_auth_removal",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null);
    const runAction = vi.fn().mockResolvedValueOnce({
      content: JSON.stringify({
        client_email: "removed@project.iam.gserviceaccount.com",
      }),
    });
    const runMutation = vi.fn().mockResolvedValue(null);
    oidcMocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "removed@project.iam.gserviceaccount.com",
        email_verified: true,
      }),
    });
    const args = {
      apiKey: "openiap-kit_pk_project",
      oidcToken: "signed-token",
      rawMessage: "raw",
      payload: {
        messageId: "redelivery_after_removal",
        packageName: "dev.openiap.test",
        eventTimeMillis: 1_000,
        subscriptionNotification: {
          notificationType: 13,
          purchaseToken: "purchase_token",
        },
      },
    };

    try {
      await expect(
        ingestGoogleRtdn._handler({ runAction, runMutation, runQuery }, args),
      ).resolves.toMatchObject({
        eventId: "event_before_removal",
        deduped: true,
      });
      await expect(
        ingestGoogleRtdn._handler({ runAction, runMutation, runQuery }, args),
      ).rejects.toThrow("service account");
      expect(runAction).toHaveBeenCalledTimes(1);
    } finally {
      process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
    }
  });

  it("rejects invalid service-account JSON before event processing", async () => {
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
    oidcMocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "pubsub@project.iam.gserviceaccount.com",
        email_verified: true,
      }),
    });

    try {
      for (const [index, content] of [
        "not-json",
        JSON.stringify({ client_email: "" }),
      ].entries()) {
        const runAction = vi.fn().mockResolvedValueOnce({ content });
        const runMutation = vi.fn();
        const runQuery = vi
          .fn()
          .mockResolvedValueOnce({
            _id: `project_invalid_json_${index}`,
            androidPackageName: "dev.openiap.test",
          })
          .mockResolvedValueOnce({ _id: `service_account_invalid_${index}` });

        await expect(
          ingestGoogleRtdn._handler(
            { runAction, runMutation, runQuery },
            {
              apiKey: `openiap-kit_pk_invalid_${index}`,
              oidcToken: "signed-token",
              rawMessage: "raw",
              payload: {
                messageId: `invalid_service_account_${index}`,
                packageName: "dev.openiap.test",
                eventTimeMillis: 1_000,
                testNotification: { version: "1.0" },
              },
            },
          ),
        ).rejects.toThrow("service account JSON");
        expect(runMutation).not.toHaveBeenCalled();
        expect(runQuery).toHaveBeenCalledTimes(2);
      }
    } finally {
      process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
    }
  });

  it("reuses one authenticated Play client for OIDC binding and enrichment", async () => {
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
    const playCallsBefore = playMocks.subscriptionsGet.mock.calls.length;
    oidcMocks.verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: "pubsub@project.iam.gserviceaccount.com",
        email_verified: true,
      }),
    });
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [
          {
            productId: "premium_monthly",
            expiryTime: "2027-09-01T00:00:00Z",
            autoRenewingPlan: {},
          },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_auth_enrichment",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce({ _id: "service_account_auth_enrichment" })
      .mockResolvedValueOnce(null);
    const runAction = vi.fn().mockResolvedValueOnce({
      content: serviceAccountContent,
    });
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({
        eventId: "event_auth_enrichment",
        type: "SubscriptionRenewed",
        deduped: false,
      })
      .mockResolvedValueOnce({ transition: "Renewed", active: true });

    try {
      await expect(
        ingestGoogleRtdn._handler(
          { runAction, runMutation, runQuery },
          {
            apiKey: "openiap-kit_pk_auth_enrichment",
            oidcToken: "signed-token",
            rawMessage: "raw",
            payload: {
              messageId: "authenticated_renewal",
              packageName: "dev.openiap.test",
              eventTimeMillis: 1_000,
              subscriptionNotification: {
                notificationType: 2,
                purchaseToken: "purchase_token",
              },
            },
          },
        ),
      ).resolves.toMatchObject({
        eventId: "event_auth_enrichment",
        deduped: false,
      });
      expect(runQuery).toHaveBeenCalledTimes(3);
      expect(runAction).toHaveBeenCalledTimes(1);
      expect(playMocks.subscriptionsGet).toHaveBeenCalledTimes(
        playCallsBefore + 1,
      );
      expect(runMutation).toHaveBeenCalledTimes(2);
      expect(runMutation.mock.calls[0]?.[1]?.event).toMatchObject({
        willRenew: false,
      });
      expect(runMutation.mock.calls[0]?.[1]?.event?.renewsAt).toBeUndefined();
    } finally {
      process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
    }
  });

  it("retries instead of recording a lifecycle event without enrichment", async () => {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_a",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const runMutation = vi.fn();

    await expect(
      ingestGoogleRtdn._handler(
        { runAction: vi.fn(), runMutation, runQuery },
        {
          apiKey: "test_key",
          rawMessage: "raw",
          payload: {
            messageId: "message_no_product",
            packageName: "dev.openiap.test",
            eventTimeMillis: 1_000,
            subscriptionNotification: {
              notificationType: 4,
              purchaseToken: "purchase_token",
            },
          },
        },
      ),
    ).rejects.toThrow("service account is required");
    expect(runMutation).not.toHaveBeenCalled();
  });

  it("uses an existing canonical product for a terminal event without enrichment", async () => {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_existing",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("premium_monthly");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_1", deduped: false })
      .mockResolvedValueOnce({ transition: "Renewed", active: true });

    await expect(
      ingestGoogleRtdn._handler(
        { runAction: vi.fn(), runMutation, runQuery },
        {
          apiKey: "test_key",
          rawMessage: "raw",
          payload: {
            messageId: "message_existing_product",
            packageName: "dev.openiap.test",
            eventTimeMillis: 1_000,
            subscriptionNotification: {
              notificationType: 13,
              purchaseToken: "purchase_token",
            },
          },
        },
      ),
    ).resolves.toMatchObject({ eventId: "event_1", deduped: false });
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: { productId: "premium_monthly" },
    });
  });

  it("keeps retained and deferred multi-item changes off the canonical SKU", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        linkedPurchaseToken: "old_token",
        lineItems: [
          {
            productId: "base",
            expiryTime: "2026-09-01T00:00:00Z",
            itemReplacement: {
              productId: "base",
              replacementMode: "KEEP_EXISTING",
            },
          },
          {
            productId: "addon",
            expiryTime: "2026-10-01T00:00:00Z",
            itemReplacement: {
              productId: "base",
              replacementMode: "DEFERRED",
            },
          },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_bundle",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce("base");
    const runAction = vi
      .fn()
      .mockResolvedValue({ content: serviceAccountContent });
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_bundle", deduped: false })
      .mockResolvedValueOnce({ transition: null, active: true });

    await ingestGoogleRtdn._handler(
      { runAction, runMutation, runQuery },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_bundle",
          packageName: "dev.openiap.test",
          eventTimeMillis: 1_000,
          subscriptionNotification: {
            notificationType: 17,
            purchaseToken: "new_token",
          },
        },
      },
    );
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: {
        productId: undefined,
        linkedPurchaseToken: "old_token",
      },
    });
  });

  it("uses item-replacement metadata for a multi-item product change", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [
          {
            productId: "premium_yearly",
            expiryTime: "2027-09-01T00:00:00Z",
            itemReplacement: {
              productId: "premium_monthly",
              replacementMode: "WITH_TIME_PRORATION",
            },
          },
          { productId: "addon", expiryTime: "2027-10-01T00:00:00Z" },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_bundle_change",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce("premium_monthly");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_change", deduped: false })
      .mockResolvedValueOnce({ transition: "ProductChanged", active: true });

    await ingestGoogleRtdn._handler(
      {
        runAction: vi
          .fn()
          .mockResolvedValue({ content: serviceAccountContent }),
        runMutation,
        runQuery,
      },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_bundle_change",
          packageName: "dev.openiap.test",
          eventTimeMillis: 1_000,
          subscriptionNotification: {
            notificationType: 17,
            purchaseToken: "purchase_token",
          },
        },
      },
    );

    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: {
        productId: "premium_yearly",
        expiresAt: Date.parse("2027-09-01T00:00:00Z"),
      },
    });
  });

  it("uses item-replacement metadata for a linked multi-item purchase", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        linkedPurchaseToken: "old_token",
        lineItems: [
          {
            productId: "premium_yearly",
            expiryTime: "2027-09-01T00:00:00Z",
            itemReplacement: {
              productId: "premium_monthly",
              replacementMode: "WITH_TIME_PRORATION",
            },
          },
          { productId: "addon", expiryTime: "2027-10-01T00:00:00Z" },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_linked_purchase",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("premium_monthly");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({
        eventId: "event_linked_purchase",
        deduped: false,
      })
      .mockResolvedValueOnce({ transition: "ProductChanged", active: true });

    await ingestGoogleRtdn._handler(
      {
        runAction: vi
          .fn()
          .mockResolvedValue({ content: serviceAccountContent }),
        runMutation,
        runQuery,
      },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_linked_purchase",
          packageName: "dev.openiap.test",
          eventTimeMillis: 1_000,
          subscriptionNotification: {
            notificationType: 4,
            purchaseToken: "new_token",
          },
        },
      },
    );

    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: {
        productId: "premium_yearly",
        linkedPurchaseToken: "old_token",
        expiresAt: Date.parse("2027-09-01T00:00:00Z"),
      },
    });
  });

  it("retains the current item for a deferred linked purchase", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        linkedPurchaseToken: "old_token",
        lineItems: [
          {
            productId: "premium_monthly",
            expiryTime: "2026-09-01T00:00:00Z",
          },
          {
            productId: "premium_yearly",
            expiryTime: "2027-09-01T00:00:00Z",
            itemReplacement: {
              productId: "premium_monthly",
              replacementMode: "DEFERRED",
            },
          },
          { productId: "addon", expiryTime: "2027-10-01T00:00:00Z" },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_deferred_purchase",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("premium_monthly");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({
        eventId: "event_deferred_purchase",
        deduped: false,
      })
      .mockResolvedValueOnce({ transition: null, active: true });

    await ingestGoogleRtdn._handler(
      {
        runAction: vi
          .fn()
          .mockResolvedValue({ content: serviceAccountContent }),
        runMutation,
        runQuery,
      },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_deferred_purchase",
          packageName: "dev.openiap.test",
          eventTimeMillis: 1_000,
          subscriptionNotification: {
            notificationType: 4,
            purchaseToken: "new_token",
          },
        },
      },
    );

    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: {
        productId: "premium_monthly",
        linkedPurchaseToken: "old_token",
        expiresAt: Date.parse("2026-09-01T00:00:00Z"),
      },
    });
  });

  it("matches the canonical product for a multi-item renewal", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [
          {
            productId: "premium_monthly",
            expiryTime: "2026-09-01T00:00:00Z",
          },
          { productId: "addon", expiryTime: "2026-10-01T00:00:00Z" },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_bundle_renewal",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce("premium_monthly");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_bundle", deduped: false })
      .mockResolvedValueOnce({ transition: "Expired", active: false });

    await ingestGoogleRtdn._handler(
      {
        runAction: vi
          .fn()
          .mockResolvedValue({ content: serviceAccountContent }),
        runMutation,
        runQuery,
      },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_bundle_renewal",
          packageName: "dev.openiap.test",
          eventTimeMillis: 1_000,
          subscriptionNotification: {
            notificationType: 2,
            purchaseToken: "purchase_token",
          },
        },
      },
    );

    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: {
        productId: "premium_monthly",
        expiresAt: Date.parse("2026-09-01T00:00:00Z"),
      },
    });
  });

  it("uses an aliased predecessor product for a late multi-item expiry", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
        lineItems: [
          {
            productId: "premium_monthly",
            expiryTime: "2026-09-01T00:00:00Z",
          },
          { productId: "addon", expiryTime: "2026-10-01T00:00:00Z" },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_aliased_expiry",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce("premium_monthly");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_expired", deduped: false })
      .mockResolvedValueOnce({ transition: null, active: true });

    await ingestGoogleRtdn._handler(
      {
        runAction: vi
          .fn()
          .mockResolvedValue({ content: serviceAccountContent }),
        runMutation,
        runQuery,
      },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_aliased_expiry",
          packageName: "dev.openiap.test",
          eventTimeMillis: Date.parse("2026-10-02T00:00:00Z"),
          subscriptionNotification: {
            notificationType: 13,
            purchaseToken: "old_purchase_token",
          },
        },
      },
    );

    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: { productId: "premium_monthly" },
    });
  });

  it("selects the unique future item when a deferred replacement first renews", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [
          {
            productId: "premium_monthly",
            expiryTime: "2026-09-01T00:00:00Z",
          },
          {
            productId: "premium_yearly",
            expiryTime: "2027-09-01T00:00:00Z",
            autoRenewingPlan: { autoRenewEnabled: true },
          },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_deferred_renewal",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce("premium_monthly");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_deferred", deduped: false })
      .mockResolvedValueOnce({ transition: "Renewed", active: true });

    await ingestGoogleRtdn._handler(
      {
        runAction: vi
          .fn()
          .mockResolvedValue({ content: serviceAccountContent }),
        runMutation,
        runQuery,
      },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_deferred_renewal",
          packageName: "dev.openiap.test",
          eventTimeMillis: Date.parse("2026-09-02T00:00:00Z"),
          subscriptionNotification: {
            notificationType: 2,
            purchaseToken: "purchase_token",
          },
        },
      },
    );

    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: {
        productId: "premium_yearly",
        expiresAt: Date.parse("2027-09-01T00:00:00Z"),
      },
    });
  });

  it("uses replacement metadata when multiple future items remain", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [
          {
            productId: "premium_monthly",
            expiryTime: "2026-09-01T00:00:00Z",
          },
          {
            productId: "premium_yearly",
            expiryTime: "2027-09-01T00:00:00Z",
            itemReplacement: { productId: "premium_monthly" },
          },
          { productId: "addon", expiryTime: "2027-10-01T00:00:00Z" },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_replacement_metadata",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce("premium_monthly");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_replacement", deduped: false })
      .mockResolvedValueOnce({ transition: "Renewed", active: true });

    await ingestGoogleRtdn._handler(
      {
        runAction: vi
          .fn()
          .mockResolvedValue({ content: serviceAccountContent }),
        runMutation,
        runQuery,
      },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_replacement_metadata",
          packageName: "dev.openiap.test",
          eventTimeMillis: Date.parse("2026-09-02T00:00:00Z"),
          subscriptionNotification: {
            notificationType: 2,
            purchaseToken: "purchase_token",
          },
        },
      },
    );

    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: {
        productId: "premium_yearly",
        expiresAt: Date.parse("2027-09-01T00:00:00Z"),
      },
    });
  });

  it("records prepaid purchases without an auto-renew promise", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [
          {
            productId: "prepaid_monthly",
            expiryTime: "2027-09-01T00:00:00Z",
            prepaidPlan: {},
          },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_prepaid",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce({
        currency: "USD",
        priceAmountMicros: 4_990_000,
      });
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ eventId: "event_prepaid", deduped: false })
      .mockResolvedValueOnce({ transition: "Started", active: true });

    await ingestGoogleRtdn._handler(
      {
        runAction: vi
          .fn()
          .mockResolvedValue({ content: serviceAccountContent }),
        runMutation,
        runQuery,
      },
      {
        apiKey: "test_key",
        rawMessage: "raw",
        payload: {
          messageId: "message_prepaid",
          packageName: "dev.openiap.test",
          eventTimeMillis: 1_000,
          subscriptionNotification: {
            notificationType: 4,
            purchaseToken: "purchase_token",
          },
        },
      },
    );

    const event = runMutation.mock.calls[0]?.[1]?.event;
    expect(event).toMatchObject({
      productId: "prepaid_monthly",
      willRenew: false,
      currency: "USD",
      priceAmountMicros: 4_990_000,
      amountProvenance: "catalog",
    });
    expect(event.renewsAt).toBeUndefined();
  });

  it("retries a multi-item purchase until verification supplies a canonical product", async () => {
    const playResponse = {
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [
          { productId: "base", expiryTime: "2026-09-01T00:00:00Z" },
          { productId: "addon", expiryTime: "2026-10-01T00:00:00Z" },
        ],
      },
    };
    playMocks.subscriptionsGet
      .mockResolvedValueOnce(playResponse)
      .mockResolvedValueOnce(playResponse);
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_bundle_purchase",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: "project_bundle_purchase",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce("base");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({
        eventId: "event_bundle_purchase",
        deduped: false,
      })
      .mockResolvedValueOnce({ transition: "Started", active: true });
    const args = {
      apiKey: "test_key",
      rawMessage: "raw",
      payload: {
        messageId: "message_bundle_purchase",
        packageName: "dev.openiap.test",
        eventTimeMillis: 1_000,
        subscriptionNotification: {
          notificationType: 4,
          purchaseToken: "purchase_token",
        },
      },
    };

    await expect(
      ingestGoogleRtdn._handler(
        {
          runAction: vi
            .fn()
            .mockResolvedValue({ content: serviceAccountContent }),
          runMutation,
          runQuery,
        },
        args,
      ),
    ).rejects.toThrow("no canonical product");
    expect(runMutation).not.toHaveBeenCalled();

    await expect(
      ingestGoogleRtdn._handler(
        {
          runAction: vi
            .fn()
            .mockResolvedValue({ content: serviceAccountContent }),
          runMutation,
          runQuery,
        },
        args,
      ),
    ).resolves.toMatchObject({
      eventId: "event_bundle_purchase",
      deduped: false,
    });
    expect(runMutation).toHaveBeenCalledTimes(2);
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      event: { productId: "base" },
    });
    expect(runMutation.mock.calls[1]?.[1]).toMatchObject({
      eventId: "event_bundle_purchase",
    });
  });

  it("does not record an event when Play enrichment fails transiently", async () => {
    playMocks.subscriptionsGet.mockRejectedValueOnce(new Error("timeout"));
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_transient_failure",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" });
    const runMutation = vi.fn();

    await expect(
      ingestGoogleRtdn._handler(
        {
          runAction: vi
            .fn()
            .mockResolvedValue({ content: serviceAccountContent }),
          runMutation,
          runQuery,
        },
        {
          apiKey: "test_key",
          rawMessage: "raw",
          payload: {
            messageId: "message_transient_failure",
            packageName: "dev.openiap.test",
            eventTimeMillis: 1_000,
            subscriptionNotification: {
              notificationType: 2,
              purchaseToken: "purchase_token",
            },
          },
        },
      ),
    ).rejects.toThrow("Google Play subscription enrichment failed");
    expect(runMutation).not.toHaveBeenCalled();
  });

  it("repairs subscription state after an event-first partial failure", async () => {
    playMocks.subscriptionsGet.mockResolvedValueOnce({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [
          {
            productId: "premium_monthly",
            expiryTime: "2026-09-01T00:00:00Z",
          },
        ],
      },
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({
        _id: "project_a",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "files_service_account" })
      .mockResolvedValueOnce({
        _id: "project_a",
        androidPackageName: "dev.openiap.test",
      })
      .mockResolvedValueOnce({
        eventId: "event_existing",
        type: "SubscriptionRenewed",
        purchaseToken: "purchase_token",
      });
    const runAction = vi
      .fn()
      .mockResolvedValue({ content: serviceAccountContent });
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
      type: "SubscriptionRenewed",
      deduped: true,
    });
    expect(runQuery).toHaveBeenCalledTimes(5);
    expect(runQuery.mock.calls[4]?.[1]).toEqual({
      projectId: "project_a",
      source: "google",
      sourceNotificationId: "message_existing",
    });
    expect(runAction).toHaveBeenCalledTimes(1);
    expect(runMutation).toHaveBeenCalledTimes(3);
    expect(runMutation.mock.calls[2]?.[1]).toEqual({
      projectId: "project_a",
      eventId: "event_existing",
    });
  });
});
