import type { Infer } from "convex/values";
import type * as v from "valibot";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { bindReasonValidator } from "../../../../../convex/utils/validation";
import type { verifyPurchaseSuccessResponseSchema } from "../../../../../server/api/v1/route-response-schemas";
import type { subscriptionEntitlementsResponseSchemaV2 } from "../../../../../server/api/v2/route-schemas";
import {
  activeSubscriptionProductIds,
  confirmPurchase,
  InvalidConfirmationRequestError,
  type BindReason,
  type EntitlementGrant,
  type GrantResult,
  type VerifyResult,
} from "./confirm-purchase";

interface Reply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

const APPLE = { store: "apple", purchaseToken: "jws.a.b", productId: "pro" };
const GOOGLE = {
  store: "google",
  purchaseToken: "play-token",
  productId: "pro",
};
const VALID = {
  store: "apple",
  isValid: true,
  state: "ENTITLED",
  productId: "pro",
  transactionId: "2000000000000002",
  originalTransactionId: "2000000000000001",
  commerceEnvironment: "production",
};
// verify reports expiresAt only for a subscription.
const SUBSCRIPTION = { ...VALID, expiresAt: 1_800_000_000_000 };

// Fake IAPKit: one reply per path, recording what the backend sent.
function setup(
  replies: { verify?: Reply; bind?: Reply; entitlements?: Reply },
  ledger: { grant?: GrantResult; owner?: string } = {},
  acceptSandbox?: (userId: string) => boolean,
  userId = "user-1",
) {
  const sent: { path: string; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    sent.push({
      path,
      body: typeof init.body === "string" ? JSON.parse(init.body) : {},
    });
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer openiap-kit_sk_test",
    );
    const reply =
      (path === "/v1/purchase/verify"
        ? replies.verify
        : path === "/v2/subscriptions/entitlements"
          ? (replies.entitlements ?? {
              body: {
                productIds: ["pro"],
                environmentScope: new URL(url).searchParams.get("environment"),
              },
            })
          : replies.bind) ?? {};
    const text =
      typeof reply.body === "string"
        ? reply.body
        : JSON.stringify(reply.body ?? {});
    return new Response(text, {
      status: reply.status ?? 200,
      headers: reply.headers,
    });
  });
  const grantOnce = vi.fn(
    async (_grant: EntitlementGrant) => ledger.grant ?? "granted",
  );
  const ownerOf = vi.fn(async (_purchaseKey: string) => ledger.owner ?? null);
  const run = (body: unknown = APPLE) =>
    confirmPurchase(userId, body, {
      secretKey: "openiap-kit_sk_test",
      ledger: { ownerOf, grantOnce },
      ...(acceptSandbox ? { acceptSandbox } : {}),
      fetch,
    });
  return { run, sent, grantOnce, ownerOf };
}

const iapkitError = (code: string) => ({
  errors: [{ code, message: `${code} from IAPKit` }],
});

describe("confirmPurchase", () => {
  it("reads only what IAPKit returns", () => {
    type VerifyBody = v.InferOutput<typeof verifyPurchaseSuccessResponseSchema>;
    type Read = keyof VerifyResult;
    expectTypeOf<Pick<VerifyBody, Read>>().toExtend<Pick<VerifyResult, Read>>();
    expectTypeOf<BindReason>().toEqualTypeOf<
      Infer<typeof bindReasonValidator>
    >();
    type Entitlements = v.InferOutput<
      typeof subscriptionEntitlementsResponseSchemaV2
    >;
    expectTypeOf<Entitlements["productIds"]>().toEqualTypeOf<string[]>();
  });

  it("links an Apple subscription and leaves its periods to IAPKit", async () => {
    const { run, sent, grantOnce, ownerOf } = setup({
      verify: { body: SUBSCRIPTION },
      bind: { body: { ok: true, bound: true, reason: "bound" } },
    });

    await expect(run()).resolves.toEqual({
      status: "entitled",
      alreadyGranted: false,
    });
    expect(sent).toEqual([
      {
        path: "/v1/purchase/verify",
        body: {
          store: "apple",
          jws: "jws.a.b",
          expectedProductId: "pro",
          includeTransactionDetails: true,
        },
      },
      {
        path: "/v1/subscriptions/bind-user",
        body: { purchaseToken: "jws.a.b", userId: "user-1" },
      },
      { path: "/v2/subscriptions/entitlements", body: {} },
    ]);
    expect(ownerOf).not.toHaveBeenCalled();
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it("restores the same account's subscription as already granted", async () => {
    const { run } = setup({
      verify: { body: SUBSCRIPTION },
      bind: { body: { ok: true, bound: true, reason: "already_bound" } },
    });

    await expect(run()).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
    });
  });

  it("gates a Google subscription on IAPKit through renewals the app never confirms", async () => {
    // Google renews under the same, already acknowledged token, so only
    // IAPKit's RTDN-driven state moves; the app never confirms it again.
    let expiresAt = 1_000;
    const now = 1_500;
    const requests: { url: URL; method?: string }[] = [];
    const options = {
      secretKey: "openiap-kit_sk_test",
      ledger: {
        ownerOf: vi.fn(async () => null),
        grantOnce: vi.fn(async (): Promise<GrantResult> => "granted"),
      },
      fetch: async (url: string, init: RequestInit) => {
        const parsed = new URL(url);
        requests.push({ url: parsed, method: init.method });
        if (parsed.pathname === "/v1/purchase/verify") {
          return Response.json({
            ...VALID,
            store: "google",
            transactionId: "GPA.1",
            originalTransactionId: undefined,
            expiresAt,
          });
        }
        if (parsed.pathname === "/v1/subscriptions/bind-user") {
          return Response.json({ ok: true, bound: true, reason: "bound" });
        }
        return Response.json({
          userId: parsed.searchParams.get("userId"),
          productIds: expiresAt > now ? ["pro"] : [],
          environmentScope: parsed.searchParams.get("environment"),
          subscriptions: [],
        });
      },
    };

    await expect(confirmPurchase("user-1", GOOGLE, options)).resolves.toEqual({
      status: "linked",
      retryAfterMs: 30_000,
    });
    await expect(
      activeSubscriptionProductIds("user-1", options),
    ).resolves.toEqual([]);
    expiresAt = 2_000; // SUBSCRIPTION_RENEWED reached IAPKit.
    await expect(
      activeSubscriptionProductIds("user-1", options),
    ).resolves.toEqual(["pro"]);

    expect(options.ledger.ownerOf).not.toHaveBeenCalled();
    expect(options.ledger.grantOnce).not.toHaveBeenCalled();
    expect(requests.at(-1)).toMatchObject({ method: "GET" });
    expect(requests.at(-1)?.url.pathname).toBe(
      "/v2/subscriptions/entitlements",
    );
    expect(requests.at(-1)?.url.searchParams.get("userId")).toBe("user-1");
  });

  it("does not grant access from an old valid receipt when the canonical subscription is revoked", async () => {
    const entitlements = {
      productIds: [] as string[],
      environmentScope: "production",
    };
    const { run, grantOnce } = setup({
      verify: { body: SUBSCRIPTION },
      bind: { body: { bound: true, reason: "already_bound" } },
      entitlements: { body: entitlements },
    });
    await expect(run()).resolves.toEqual({
      status: "linked",
      retryAfterMs: 30_000,
    });
    expect(grantOnce).not.toHaveBeenCalled();
    entitlements.productIds.push("pro");
    await expect(run()).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
    });
  });

  it("leaves access unconfirmed when the canonical entitlement lookup fails", async () => {
    const { run, grantOnce } = setup({
      verify: { body: SUBSCRIPTION },
      bind: { body: { bound: true, reason: "bound" } },
      entitlements: { status: 503 },
    });
    await expect(run()).rejects.toThrow(
      "/v2/subscriptions/entitlements returned 503",
    );
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it("finishes an Apple renewal delivered to another signed-in account", async () => {
    // The device's Apple ID renews user-1's subscription while user-2 is
    // signed in; IAPKit still advances user-1's period from the store.
    const { run, ownerOf, grantOnce } = setup(
      {
        verify: {
          body: { ...SUBSCRIPTION, transactionId: "2000000000000003" },
        },
        bind: {
          body: { ok: true, bound: false, reason: "bound_to_other_user" },
        },
      },
      {},
      undefined,
      "user-2",
    );

    await expect(run()).resolves.toEqual({
      status: "ownership_conflict",
      alreadyGranted: true,
    });
    expect(ownerOf).not.toHaveBeenCalled();
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it.each(["not_found", "not_bindable"])(
    "keeps a subscription IAPKit cannot link (%s) unfinished",
    async (reason) => {
      const { run, grantOnce } = setup({
        verify: { body: SUBSCRIPTION },
        bind: { body: { ok: true, bound: false, reason } },
      });

      await expect(run()).resolves.toEqual({
        status: "verified",
        retryAfterMs: 30_000,
      });
      expect(grantOnce).not.toHaveBeenCalled();
    },
  );

  it("reads active subscriptions with the secret key and fails on an IAPKit error", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get("authorization")).toBe(
        "Bearer openiap-kit_sk_test",
      );
      expect(new URL(url).searchParams.get("userId")).toBe("user 1/2");
      return Response.json(
        {
          errors: [{ code: "SUBSCRIPTION_ENTITLEMENTS_FAILED", message: "x" }],
        },
        { status: 500 },
      );
    });

    await expect(
      activeSubscriptionProductIds("user 1/2", {
        secretKey: "openiap-kit_sk_test",
        fetch,
      }),
    ).rejects.toThrow(
      "/v2/subscriptions/entitlements returned 500 SUBSCRIPTION_ENTITLEMENTS_FAILED",
    );
  });

  it("links and grants an unacknowledged Google purchase by its token", async () => {
    const { run, sent, grantOnce } = setup({
      verify: {
        body: {
          store: "google",
          isValid: true,
          state: "PENDING_ACKNOWLEDGMENT",
          productId: "pro",
          commerceEnvironment: "production",
        },
      },
      bind: { body: { ok: true, bound: true, reason: "bound" } },
    });

    await expect(run(GOOGLE)).resolves.toEqual({
      status: "entitled",
      alreadyGranted: false,
    });
    expect(sent[0]?.body).toMatchObject({ purchaseToken: "play-token" });
    expect(grantOnce).toHaveBeenCalledWith({
      purchaseKey: JSON.stringify(["google", "play-token", "pro"]),
      userId: "user-1",
      productId: "pro",
      store: "google",
    });
  });

  it("grants each verified product in a Play cart once under the same owner", async () => {
    const grants = new Map<string, EntitlementGrant>();
    let tokenOwner: string | null = null;
    const options = {
      secretKey: "openiap-kit_sk_test",
      ledger: {
        ownerOf: async (key: string) => grants.get(key)?.userId ?? null,
        grantOnce: async (grant: EntitlementGrant): Promise<GrantResult> => {
          const existing = grants.get(grant.purchaseKey);
          if (existing)
            return existing.userId === grant.userId
              ? "already_granted"
              : "granted_to_other_user";
          grants.set(grant.purchaseKey, grant);
          return "granted";
        },
      },
      fetch: async (url: string, init: RequestInit) => {
        if (typeof init.body !== "string")
          throw new Error("Expected a JSON request body");
        const body: Record<string, string> = JSON.parse(init.body);
        if (new URL(url).pathname === "/v1/purchase/verify") {
          return Response.json({
            ...VALID,
            store: "google",
            productId: body.expectedProductId,
          });
        }
        const reason =
          tokenOwner === null
            ? "bound"
            : tokenOwner === body.userId
              ? "already_bound"
              : "bound_to_other_user";
        tokenOwner ??= body.userId;
        return Response.json({
          bound: reason !== "bound_to_other_user",
          reason,
        });
      },
    };
    for (const productId of ["cart-a", "cart-b"]) {
      await expect(
        confirmPurchase("user-1", { ...GOOGLE, productId }, options),
      ).resolves.toEqual({ status: "entitled", alreadyGranted: false });
      await expect(
        confirmPurchase("user-1", { ...GOOGLE, productId }, options),
      ).resolves.toEqual({ status: "entitled", alreadyGranted: true });
      await expect(
        confirmPurchase("user-2", { ...GOOGLE, productId }, options),
      ).resolves.toEqual({
        status: "ownership_conflict",
        alreadyGranted: true,
      });
    }
    await expect(
      confirmPurchase("user-2", { ...GOOGLE, productId: "cart-c" }, options),
    ).resolves.toEqual({ status: "ownership_conflict", alreadyGranted: false });
    expect(
      [...grants.values()].map(({ userId, productId }) => ({
        userId,
        productId,
      })),
    ).toEqual([
      { userId: "user-1", productId: "cart-a" },
      { userId: "user-1", productId: "cart-b" },
    ]);
  });

  it("restores the same account as already granted", async () => {
    const { run } = setup(
      {
        verify: { body: VALID },
        bind: { body: { ok: true, bound: true, reason: "already_bound" } },
      },
      { grant: "already_granted", owner: "user-1" },
    );

    await expect(run()).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
    });
  });

  it.each([
    [503, "7", iapkitError("SERVICE_BUSY"), 7_000],
    [429, "2", iapkitError("RATE_LIMITED"), 2_000],
    [429, "60", iapkitError("DUPLICATE_PAYLOAD"), 60_000],
    [503, undefined, "<html>Bad gateway</html>", 30_000],
  ])(
    "maps a %i (retry-after %s) %j from verify to verification_delayed",
    async (status, retryAfter, body, retryAfterMs) => {
      const { run, sent } = setup({
        verify: {
          status,
          ...(retryAfter ? { headers: { "retry-after": retryAfter } } : {}),
          body,
        },
      });

      await expect(run()).resolves.toEqual({
        status: "verification_delayed",
        retryAfterMs,
      });
      expect(sent).toHaveLength(1);
    },
  );

  it("reports a receipt IAPKit just rejected as invalid", async () => {
    const { run, sent, grantOnce } = setup({
      verify: {
        status: 429,
        headers: { "retry-after": "300" },
        body: iapkitError("REPEATED_FAILURE"),
      },
    });

    await expect(run()).resolves.toEqual({
      status: "invalid",
      reason: "REPEATED_FAILURE",
    });
    expect(sent).toHaveLength(1);
    expect(grantOnce).not.toHaveBeenCalled();
  });

  const delayed = { status: "verification_delayed", retryAfterMs: 30_000 };
  it.each([
    [{ state: "PENDING" }, { status: "store_pending" }],
    [{ state: "UNKNOWN" }, delayed],
    [{ state: "UNKNOWN", finalVerdict: false }, delayed],
    [
      { state: "UNKNOWN", finalVerdict: true },
      { status: "invalid", reason: "UNKNOWN" },
    ],
    [{ state: "INAUTHENTIC" }, { status: "invalid", reason: "INAUTHENTIC" }],
    [
      { state: "EXPIRED", finalVerdict: true },
      { status: "invalid", reason: "EXPIRED" },
    ],
  ])("maps a %j verdict without linking", async (verdict, expected) => {
    const { run, sent, grantOnce } = setup({
      verify: { body: { store: "google", isValid: false, ...verdict } },
    });

    await expect(run()).resolves.toEqual(expected);
    expect(sent).toHaveLength(1);
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it.each([undefined, "xcode"])(
    "fails closed without settling a valid purchase with an unrecognized %s environment",
    async (commerceEnvironment) => {
      const { run } = setup(
        {
          verify: { body: { ...VALID, commerceEnvironment } },
          bind: { body: { ok: true, bound: true, reason: "bound" } },
        },
        {},
        () => false,
      );

      await expect(run()).rejects.toThrow("no verified purchase environment");
    },
  );

  it("restricts Sandbox by default and explicitly allows the authenticated App Review account", async () => {
    const sandbox = { ...VALID, commerceEnvironment: "sandbox" };
    const bound = { body: { ok: true, bound: true, reason: "bound" } };
    const byDefault = setup({ verify: { body: sandbox }, bind: bound });
    const allowList = vi.fn((userId: string) => userId === "app-review");
    const restricted = setup(
      { verify: { body: sandbox }, bind: bound },
      {},
      allowList,
    );

    await expect(byDefault.run()).resolves.toEqual({
      status: "test_account_restricted",
    });
    expect(byDefault.grantOnce).not.toHaveBeenCalled();
    const approved = setup(
      { verify: { body: sandbox }, bind: bound },
      {},
      allowList,
      "app-review",
    );
    await expect(approved.run()).resolves.toMatchObject({ status: "entitled" });
    await expect(restricted.run()).resolves.toEqual({
      status: "test_account_restricted",
    });
    expect(allowList).toHaveBeenCalledWith("user-1");
    expect(restricted.sent).toHaveLength(1);
  });

  it("uses the same test-account policy on later entitlement refresh and rejects old servers ignoring it", async () => {
    const seen: string[] = [];
    const options = {
      secretKey: "openiap-kit_sk_test",
      acceptSandbox: (userId: string) => userId === "app-review",
      fetch: async (url: string) => {
        const scope = new URL(url).searchParams.get("environment")!;
        seen.push(scope);
        return Response.json({
          environmentScope: scope,
          productIds:
            scope === "all" ? ["test-access", "paid-access"] : ["paid-access"],
        });
      },
    };
    await expect(
      activeSubscriptionProductIds("ordinary", options),
    ).resolves.toEqual(["paid-access"]);
    await expect(
      activeSubscriptionProductIds("app-review", options),
    ).resolves.toEqual(["test-access", "paid-access"]);
    expect(seen).toEqual(["production", "all"]);
    for (const acknowledgement of [undefined, "all"]) {
      await expect(
        activeSubscriptionProductIds("ordinary", {
          ...options,
          fetch: async () =>
            Response.json({
              productIds: ["test-access"],
              environmentScope: acknowledgement,
            }),
        }),
      ).rejects.toThrow("did not acknowledge");
    }
  });

  it("reports an IAPKit owner conflict nobody was granted and never grants", async () => {
    const { run, grantOnce } = setup({
      verify: { body: VALID },
      bind: { body: { ok: true, bound: false, reason: "bound_to_other_user" } },
    });

    await expect(run()).resolves.toEqual({
      status: "ownership_conflict",
      alreadyGranted: false,
    });
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it("follows the ledger when it granted the purchase to the caller IAPKit says is not its owner", async () => {
    const { run, grantOnce } = setup(
      {
        verify: { body: VALID },
        bind: {
          body: { ok: true, bound: false, reason: "bound_to_other_user" },
        },
      },
      { owner: "user-1", grant: "already_granted" },
    );

    await expect(run()).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
    });
    expect(grantOnce).toHaveBeenCalledOnce();
  });

  it("refuses another user's purchase before linking it in IAPKit", async () => {
    const { run, sent, ownerOf, grantOnce } = setup(
      {
        verify: { body: VALID },
        bind: { body: { ok: true, bound: true, reason: "bound" } },
      },
      { owner: "user-2" },
    );

    await expect(run()).resolves.toEqual({
      status: "ownership_conflict",
      alreadyGranted: true,
    });
    expect(ownerOf).toHaveBeenCalledWith(
      JSON.stringify(["apple", "2000000000000001", "pro"]),
    );
    expect(sent.map(({ path }) => path)).toEqual(["/v1/purchase/verify"]);
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it("reports a ledger owner conflict from a concurrent grant", async () => {
    const { run } = setup(
      {
        verify: { body: VALID },
        bind: { body: { ok: true, bound: false, reason: "not_bindable" } },
      },
      { grant: "granted_to_other_user" },
    );

    await expect(run()).resolves.toEqual({
      status: "ownership_conflict",
      alreadyGranted: true,
    });
  });

  it.each([
    ["bound", "linked"],
    ["not_bindable", "verified"],
  ])(
    "reports a deferred grant after a %s bind as %s",
    async (reason, status) => {
      const { run } = setup(
        {
          verify: { body: VALID },
          bind: { body: { ok: true, bound: reason === "bound", reason } },
        },
        { grant: "deferred" },
      );

      await expect(run()).resolves.toEqual({ status, retryAfterMs: 30_000 });
    },
  );

  it("reports verified when linking is rate limited", async () => {
    const { run, grantOnce } = setup({
      verify: { body: VALID },
      bind: { status: 429, headers: { "retry-after": "3" } },
    });

    await expect(run()).resolves.toEqual({
      status: "verified",
      retryAfterMs: 3_000,
    });
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it.each([
    [{ verify: { status: 400, body: { errors: [] } } }, "returned 400"],
    [
      {
        verify: { body: VALID },
        bind: { body: { ok: true, bound: false } },
      },
      "call it with a secret key",
    ],
    [
      {
        verify: { body: VALID },
        bind: { body: { ok: true, bound: false, reason: "suspended" } },
      },
      "unknown reason: suspended",
    ],
    [
      {
        verify: {
          body: {
            ...VALID,
            originalTransactionId: undefined,
            transactionId: undefined,
          },
        },
      },
      "no transaction details",
    ],
  ])("throws on unexpected IAPKit answers", async (replies, message) => {
    const { run, grantOnce } = setup(replies);

    await expect(run()).rejects.toThrow(message);
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it.each(["INVALID_INPUT", "APP_STORE_INVALID_JWS_FORMAT"])(
    "reports evidence verify can never accept (400 %s) as invalid",
    async (code) => {
      const { run, sent } = setup({
        verify: { status: 400, body: iapkitError(code) },
      });

      await expect(run()).resolves.toEqual({ status: "invalid", reason: code });
      expect(sent).toHaveLength(1);
    },
  );

  // Fixing the configuration makes the same purchase valid, so none settles it.
  it.each([
    [400, "APP_STORE_SERVER_CREDENTIALS_MISSING"],
    [400, "APP_STORE_BUNDLE_ID_MISMATCH"],
    [400, "APP_STORE_TRANSACTION_VERIFICATION_FAILED"],
    [400, "PLAY_STORE_VERIFICATION_ERROR"],
    [400, "INVALID_API_KEY"],
    [500, "UNKNOWN_ERROR"],
  ])("throws for a %i %s from verify", async (status, code) => {
    const { run, sent } = setup({
      verify: { status, body: iapkitError(code) },
    });

    await expect(run()).rejects.toThrow(
      `/v1/purchase/verify returned ${status} ${code}`,
    );
    expect(sent).toHaveLength(1);
  });

  it.each([
    null,
    {},
    { ...APPLE, store: "amazon" },
    { ...APPLE, productId: "" },
  ])("rejects a malformed body before calling IAPKit: %j", async (body) => {
    const { run, sent } = setup({});

    await expect(run(body)).rejects.toThrow(InvalidConfirmationRequestError);
    expect(sent).toHaveLength(0);
  });

  it("keeps a network failure apart from a malformed body", async () => {
    const offline = new TypeError("fetch failed");

    const confirm = confirmPurchase("user-1", APPLE, {
      secretKey: "openiap-kit_sk_test",
      ledger: { ownerOf: async () => null, grantOnce: async () => "granted" },
      fetch: async () => {
        throw offline;
      },
    });

    await expect(confirm).rejects.toBe(offline);
    await expect(confirm).rejects.not.toBeInstanceOf(
      InvalidConfirmationRequestError,
    );
  });
});
