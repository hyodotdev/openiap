import type { Infer } from "convex/values";
import type * as v from "valibot";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { bindReasonValidator } from "../../../../../convex/utils/validation";
import type { verifyPurchaseSuccessResponseSchema } from "../../../../../server/api/v1/route-response-schemas";
import {
  confirmPurchase,
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

// Fake IAPKit: one reply per path, recording what the backend sent.
function setup(
  replies: { verify?: Reply; bind?: Reply },
  grant: GrantResult = "granted",
  acceptSandbox = false,
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
      (path === "/v1/purchase/verify" ? replies.verify : replies.bind) ?? {};
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: reply.headers,
    });
  });
  const grantOnce = vi.fn(async (_grant: EntitlementGrant) => grant);
  const run = (body: unknown = APPLE) =>
    confirmPurchase("user-1", body, {
      secretKey: "openiap-kit_sk_test",
      ledger: { grantOnce },
      acceptSandbox,
      fetch,
    });
  return { run, sent, grantOnce };
}

describe("confirmPurchase", () => {
  it("reads only what IAPKit returns", () => {
    type VerifyBody = v.InferOutput<typeof verifyPurchaseSuccessResponseSchema>;
    expectTypeOf<
      Pick<VerifyBody, keyof VerifyResult>
    >().toExtend<VerifyResult>();
    expectTypeOf<BindReason>().toEqualTypeOf<
      Infer<typeof bindReasonValidator>
    >();
  });

  it("verifies, links, and grants an Apple purchase once", async () => {
    const { run, sent, grantOnce } = setup({
      verify: { body: { ...VALID, expiresAt: 1_800_000_000_000 } },
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
    ]);
    expect(grantOnce).toHaveBeenCalledWith({
      purchaseKey: "2000000000000001",
      userId: "user-1",
      productId: "pro",
      store: "apple",
      transactionId: "2000000000000002",
      expiresAt: 1_800_000_000_000,
    });
  });

  it("links and grants an unacknowledged Google purchase by its token", async () => {
    const { run, sent, grantOnce } = setup({
      verify: {
        body: {
          store: "google",
          isValid: true,
          state: "PENDING_ACKNOWLEDGMENT",
          productId: "pro",
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
      purchaseKey: "play-token",
      userId: "user-1",
      productId: "pro",
      store: "google",
    });
  });

  it("restores the same account as already granted", async () => {
    const { run } = setup(
      {
        verify: { body: VALID },
        bind: { body: { ok: true, bound: true, reason: "already_bound" } },
      },
      "already_granted",
    );

    await expect(run()).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
    });
  });

  it.each([
    [503, { "retry-after": "7" }, 7_000],
    [429, { "retry-after": "2" }, 2_000],
    [503, undefined, 30_000],
  ])(
    "maps a %i from verify to verification_delayed",
    async (status, headers, retryAfterMs) => {
      const { run, sent } = setup({
        verify: {
          status,
          headers,
          body: { errors: [{ code: "SERVICE_BUSY" }] },
        },
      });

      await expect(run()).resolves.toEqual({
        status: "verification_delayed",
        retryAfterMs,
      });
      expect(sent).toHaveLength(1);
    },
  );

  it.each([
    ["PENDING", { status: "store_pending" }],
    ["UNKNOWN", { status: "verification_delayed", retryAfterMs: 30_000 }],
    ["INAUTHENTIC", { status: "invalid", reason: "INAUTHENTIC" }],
    ["EXPIRED", { status: "invalid", reason: "EXPIRED" }],
  ])("maps a %s verdict without linking", async (state, expected) => {
    const { run, sent, grantOnce } = setup({
      verify: { body: { store: "apple", isValid: false, state } },
    });

    await expect(run()).resolves.toEqual(expected);
    expect(sent).toHaveLength(1);
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it("restricts sandbox purchases unless this deployment accepts them", async () => {
    const sandbox = { ...VALID, commerceEnvironment: "sandbox" };
    const bound = { body: { ok: true, bound: true, reason: "bound" } };
    const restricted = setup({ verify: { body: sandbox }, bind: bound });
    const accepted = setup(
      { verify: { body: sandbox }, bind: bound },
      "granted",
      true,
    );

    await expect(restricted.run()).resolves.toEqual({
      status: "test_account_restricted",
    });
    expect(restricted.sent).toHaveLength(1);
    await expect(accepted.run()).resolves.toMatchObject({
      status: "entitled",
    });
  });

  it("reports an IAPKit owner conflict and never grants", async () => {
    const { run, grantOnce } = setup({
      verify: { body: VALID },
      bind: { body: { ok: true, bound: false, reason: "bound_to_other_user" } },
    });

    await expect(run()).resolves.toEqual({ status: "ownership_conflict" });
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it("reports a ledger owner conflict", async () => {
    const { run } = setup(
      {
        verify: { body: VALID },
        bind: { body: { ok: true, bound: false, reason: "not_bindable" } },
      },
      "granted_to_other_user",
    );

    await expect(run()).resolves.toEqual({ status: "ownership_conflict" });
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
        "deferred",
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

  it.each([
    null,
    {},
    { ...APPLE, store: "amazon" },
    { ...APPLE, productId: "" },
  ])("rejects a malformed body before calling IAPKit: %j", async (body) => {
    const { run, sent } = setup({});

    await expect(run(body)).rejects.toThrow(TypeError);
    expect(sent).toHaveLength(0);
  });
});
