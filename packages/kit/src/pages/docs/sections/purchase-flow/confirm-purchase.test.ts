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
  ledger: { grant?: GrantResult; owner?: string } = {},
  acceptSandbox?: (userId: string) => boolean,
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
    confirmPurchase("user-1", body, {
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

  it("accepts sandbox purchases unless acceptSandbox refuses the user", async () => {
    const sandbox = { ...VALID, commerceEnvironment: "sandbox" };
    const bound = { body: { ok: true, bound: true, reason: "bound" } };
    const byDefault = setup({ verify: { body: sandbox }, bind: bound });
    const allowList = vi.fn((userId: string) => userId === "app-review");
    const restricted = setup(
      { verify: { body: sandbox }, bind: bound },
      {},
      allowList,
    );

    await expect(byDefault.run()).resolves.toMatchObject({
      status: "entitled",
    });
    await expect(restricted.run()).resolves.toEqual({
      status: "test_account_restricted",
    });
    expect(allowList).toHaveBeenCalledWith("user-1");
    expect(restricted.sent).toHaveLength(1);
  });

  it("reports an IAPKit owner conflict and never grants", async () => {
    const { run, grantOnce } = setup({
      verify: { body: VALID },
      bind: { body: { ok: true, bound: false, reason: "bound_to_other_user" } },
    });

    await expect(run()).resolves.toEqual({ status: "ownership_conflict" });
    expect(grantOnce).not.toHaveBeenCalled();
  });

  it("refuses another user's purchase before linking it in IAPKit", async () => {
    const { run, sent, ownerOf, grantOnce } = setup(
      {
        verify: { body: VALID },
        bind: { body: { ok: true, bound: true, reason: "bound" } },
      },
      { owner: "user-2" },
    );

    await expect(run()).resolves.toEqual({ status: "ownership_conflict" });
    expect(ownerOf).toHaveBeenCalledWith("2000000000000001");
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
