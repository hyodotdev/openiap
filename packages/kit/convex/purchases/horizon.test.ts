import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildHorizonRemoteId,
  parseHorizonResponse,
  ReceiptVerificationError,
  verifyMetaHorizonReceiptInternalV1 as registeredVerifyMetaHorizonReceipt,
} from "./horizon";
import { testableFunction } from "../test.setup";

const verifyMetaHorizonReceipt = testableFunction(
  registeredVerifyMetaHorizonReceipt,
);

const PROJECT = {
  _id: "project_horizon",
  horizonEnabled: true,
  horizonAppId: "1234567890123456",
  horizonAppSecret: "secret_value",
};

const VERIFY_ARGS = {
  apiKey: "openiap-kit_pk_test",
  userId: "meta-user-1",
  sku: "premium_monthly",
  requestIp: "203.0.113.1",
};

function makeContext(project: typeof PROJECT | null = PROJECT) {
  return {
    runQuery: vi.fn(async (_function: unknown, _args: unknown) => project),
    runMutation: vi.fn(
      async (_function: unknown, _args: Record<string, unknown>) => null,
    ),
  };
}

async function capture<T>(
  promise: Promise<T>,
): Promise<{ value: T; error?: never } | { value?: never; error: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

function expectHorizonError(error: unknown): ReceiptVerificationError {
  expect(error).toBeInstanceOf(ReceiptVerificationError);
  const receiptError = error as ReceiptVerificationError;
  expect(receiptError.errorCode).toBe("META_HORIZON_VERIFICATION_ERROR");
  return receiptError;
}

describe("verifyMetaHorizonReceiptInternalV1", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("persists and returns a confirmed success=true response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, grant_time: 1_744_148_687 }),
        { status: 200 },
      ),
    );
    const ctx = makeContext();

    await expect(
      verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
    ).resolves.toEqual({
      isValid: true,
      state: "ENTITLED",
      productId: "premium_monthly",
    });

    expect(ctx.runQuery).toHaveBeenCalledWith(expect.anything(), {
      apiKey: VERIFY_ARGS.apiKey,
      requiredAccess: "client",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://graph.oculus.com/1234567890123456/verify_entitlement",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(typeof init?.body).toBe("string");
    const form = new URLSearchParams(init?.body as string);
    expect(Object.fromEntries(form.entries())).toEqual({
      access_token: "OC|1234567890123456|secret_value",
      user_id: "meta-user-1",
      sku: "premium_monthly",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
    const saved = ctx.runMutation.mock.calls[0]?.[1];
    expect(saved).toMatchObject({
      projectId: "project_horizon",
      store: "horizon",
      applicationId: "1234567890123456",
      remoteId: "meta-user-1:premium_monthly",
      requestData: {
        store: "horizon",
        userId: "meta-user-1",
        sku: "premium_monthly",
      },
      state: "ENTITLED",
      isValid: true,
      requestIp: "203.0.113.1",
      verificationDurationMs: expect.any(Number),
    });
    expect(JSON.parse(saved?.remoteResponse as string)).toEqual({
      success: true,
      grantTimeMs: 1_744_148_687_000,
      sku: "premium_monthly",
    });
  });

  test("persists a confirmed success=false response as INAUTHENTIC", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );
    const ctx = makeContext();

    await expect(
      verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
    ).resolves.toEqual({
      isValid: false,
      state: "INAUTHENTIC",
      productId: "premium_monthly",
    });

    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
    const saved = ctx.runMutation.mock.calls[0]?.[1];
    expect(saved).toMatchObject({ state: "INAUTHENTIC", isValid: false });
    expect(JSON.parse(saved?.remoteResponse as string)).toEqual({
      success: false,
      sku: "premium_monthly",
    });
  });

  test.each([
    [{}, "missing a boolean success field"],
    [{ success: "true" }, "missing a boolean success field"],
    [null, "unparseable body"],
  ])(
    "rejects an ambiguous 2xx body without persisting it: %j",
    async (body, message) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(body), { status: 200 }),
      );
      const ctx = makeContext();

      const result = await capture(
        verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
      );

      const error = expectHorizonError(result.error);
      expect(error.errorMessage).toContain(message);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).not.toHaveBeenCalled();
    },
  );

  test("rejects invalid JSON without persisting it", async () => {
    fetchMock.mockResolvedValue(new Response("{", { status: 200 }));
    const ctx = makeContext();

    const result = await capture(
      verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
    );

    const error = expectHorizonError(result.error);
    expect(error.errorMessage).toContain("returned invalid JSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("does not retry or persist a deterministic HTTP 4xx failure", async () => {
    fetchMock.mockResolvedValue(new Response("denied", { status: 400 }));
    const ctx = makeContext();

    const result = await capture(
      verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
    );

    const error = expectHorizonError(result.error);
    expect(error.errorMessage).toContain("Error 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("retries HTTP 429 and 5xx before persisting a confirmed result", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const ctx = makeContext();

    const resultPromise = capture(
      verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({ isValid: true, state: "ENTITLED" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
  });

  test("retries a fetch network failure before persisting a confirmed result", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false }), { status: 200 }),
      );
    const ctx = makeContext();

    const resultPromise = capture(
      verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      isValid: false,
      state: "INAUTHENTIC",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
  });

  test("retries each timed-out request and never persists an inferred verdict", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      async (_input: URL | RequestInfo, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("request timed out");
              error.name = "AbortError";
              reject(error);
            },
            { once: true },
          );
        }),
    );
    const ctx = makeContext();

    const resultPromise = capture(
      verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    const error = expectHorizonError(result.error);
    expect(error.errorMessage).toContain("AbortError");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("exhausted 5xx retries do not overwrite the last confirmed receipt", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response("unavailable", { status: 503 }));
    const ctx = makeContext();

    const resultPromise = capture(
      verifyMetaHorizonReceipt._handler(ctx, VERIFY_ARGS),
    );
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    const error = expectHorizonError(result.error);
    expect(error.errorMessage).toContain("Error 503");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});

describe("parseHorizonResponse", () => {
  test("converts a finite grant_time from seconds to milliseconds", () => {
    expect(
      parseHorizonResponse({ success: true, grant_time: 1_744_148_687 }),
    ).toEqual({ success: true, grantTime: 1_744_148_687_000 });
  });

  test("ignores a non-finite grant_time after accepting the boolean verdict", () => {
    expect(
      parseHorizonResponse({ success: false, grant_time: Infinity }),
    ).toEqual({ success: false, grantTime: undefined });
  });
});

describe("buildHorizonRemoteId", () => {
  test("produces a colon-joined pair of URL-encoded parts", () => {
    expect(buildHorizonRemoteId("user-1", "coin_pack_100")).toBe(
      "user-1:coin_pack_100",
    );
  });

  test("disambiguates across every colon placement", () => {
    // These two inputs would collide with the old `${userId}:${sku}`
    // scheme: split "a:b:c" back into (userId, sku) ambiguously.
    // URL-encoding the parts makes both encodings unique.
    const a = buildHorizonRemoteId("a:b", "c");
    const b = buildHorizonRemoteId("a", "b:c");
    expect(a).not.toBe(b);
  });

  test("encodes slashes and other separator-adjacent characters", () => {
    // Meta SKUs are free-form strings; make sure the encoding handles
    // things that would otherwise look like path separators.
    expect(buildHorizonRemoteId("u/1", "p/2")).toBe("u%2F1:p%2F2");
    expect(buildHorizonRemoteId("u 1", "p 2")).toBe("u%201:p%202");
  });

  test("leaves ASCII-alphanumeric untouched", () => {
    expect(buildHorizonRemoteId("ABC123", "sku_abc-123")).toBe(
      "ABC123:sku_abc-123",
    );
  });
});
