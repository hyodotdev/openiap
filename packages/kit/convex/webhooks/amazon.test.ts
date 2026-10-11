import { afterEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import fixture from "./fixtures/amazon-sns.json";
import { ingestAmazonRtnHandler } from "./amazon";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function context(overrides: Record<string, unknown> = {}, duplicate = false) {
  vi.useFakeTimers({ now: fixture.now });
  const project = {
    _id: "projects_test",
    androidPackageName: "dev.hyo.martie",
    amazonRtnTopicArn: fixture.v2.TopicArn,
    amazonSharedSecret: "production-secret",
    ...overrides,
  };
  const runQuery = vi.fn(async (ref, _args: unknown) =>
    getFunctionName(ref).endsWith("getAmazonWebhookProject")
      ? project
      : duplicate
        ? { type: "SubscriptionRenewed" }
        : null,
  );
  const runMutation = vi.fn(async (ref, _args: unknown) =>
    getFunctionName(ref).endsWith("reserveAmazonRvsSequence")
      ? 1
      : { type: "SubscriptionRenewed", deduped: false },
  );
  return { ctx: { runQuery, runMutation } as never, runMutation };
}

function fetchUrl(input: string | URL | Request): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

function store(overrides: Record<string, unknown> = {}, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (fetchUrl(url).endsWith(".pem"))
      return new Response(fixture.certificate);
    return new Response(
      JSON.stringify({
        receiptId: "receipt-1",
        productId: "premium",
        productType: "SUBSCRIPTION",
        cancelDate: null,
        autoRenewing: true,
        betaProduct: true,
        ...overrides,
      }),
      { status },
    );
  });
}

describe("Amazon RTN receiver", () => {
  it("verifies the actual signature before RVS, and LAT uses production credentials with verified Sandbox provenance", async () => {
    const { ctx, runMutation } = context();
    const fetch = store();
    await ingestAmazonRtnHandler(ctx, {
      apiKey: "publishable",
      rawEnvelope: JSON.stringify(fixture.v2),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetchUrl(fetch.mock.calls[1][0])).toContain(
      "/developer/production-secret/",
    );
    expect(fetchUrl(fetch.mock.calls[1][0])).not.toContain("/sandbox/");
    expect(runMutation.mock.calls.at(-1)?.[1]).toMatchObject({
      environment: "Sandbox",
      state: "ENTITLED",
      amazonRvsSequence: 1,
      amazonNotice: { notificationType: "SUBSCRIPTION_RENEWED" },
    });
  });

  it("a notification's beta flag cannot mark an ordinary production RVS response as Sandbox", async () => {
    const { ctx, runMutation } = context();
    store({ betaProduct: false });
    await ingestAmazonRtnHandler(ctx, {
      apiKey: "publishable",
      rawEnvelope: JSON.stringify(fixture.v2),
    });
    expect(runMutation.mock.calls.at(-1)?.[1]).toMatchObject({
      environment: "Production",
    });
  });

  it.each(["unknown", "expired"] as const)(
    "refreshes RVS for %s without trusting the notice as a verdict",
    async (name) => {
      const { ctx, runMutation } = context();
      store();
      await ingestAmazonRtnHandler(ctx, {
        apiKey: "publishable",
        rawEnvelope: JSON.stringify(fixture[name]),
      });
      expect(runMutation.mock.calls.at(-1)?.[1]).toMatchObject({
        state: "ENTITLED",
      });
    },
  );

  it("rejects a forged signature or a signed foreign app before RVS and mutations", async () => {
    for (const envelope of [
      { ...fixture.v2, Message: fixture.unknown.Message },
      fixture.foreignApp,
    ]) {
      const { ctx, runMutation } = context();
      const fetch = store();
      await expect(
        ingestAmazonRtnHandler(ctx, {
          apiKey: "publishable",
          rawEnvelope: JSON.stringify(envelope),
        }),
      ).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(runMutation).not.toHaveBeenCalled();
      fetch.mockRestore();
    }
  });

  it("an authenticated retry skips RVS and writes", async () => {
    const { ctx, runMutation } = context({}, true);
    const fetch = store();
    await expect(
      ingestAmazonRtnHandler(ctx, {
        apiKey: "publishable",
        rawEnvelope: JSON.stringify(fixture.v2),
      }),
    ).resolves.toMatchObject({ deduped: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(runMutation).not.toHaveBeenCalled();
  });

  it("transient RVS failure retries without persisting an invalid verdict", async () => {
    const { ctx, runMutation } = context();
    store({}, 503);
    await expect(
      ingestAmazonRtnHandler(ctx, {
        apiKey: "publishable",
        rawEnvelope: JSON.stringify(fixture.v2),
      }),
    ).rejects.toMatchObject({ data: { code: "AMAZON_RVS_UNAVAILABLE" } });
    expect(
      runMutation.mock.calls.some(([ref]) =>
        getFunctionName(ref).endsWith("applyAmazonRtnVerdict"),
      ),
    ).toBe(false);
  });

  it("definitive RVS 410 persists revocation evidence", async () => {
    const { ctx, runMutation } = context();
    store({}, 410);
    await ingestAmazonRtnHandler(ctx, {
      apiKey: "publishable",
      rawEnvelope: JSON.stringify(fixture.expired),
    });
    expect(runMutation.mock.calls.at(-1)?.[1]).toMatchObject({
      state: "CANCELED",
    });
  });

  it("an invalid shared secret is a configuration error without a purchase verdict", async () => {
    const { ctx, runMutation } = context();
    store({}, 496);
    await expect(
      ingestAmazonRtnHandler(ctx, {
        apiKey: "publishable",
        rawEnvelope: JSON.stringify(fixture.v2),
      }),
    ).rejects.toMatchObject({ data: { code: "AMAZON_RTN_NOT_CONFIGURED" } });
    expect(
      runMutation.mock.calls.some(([ref]) =>
        getFunctionName(ref).endsWith("applyAmazonRtnVerdict"),
      ),
    ).toBe(false);
  });

  it("source-key rejection and missing configuration happen before any external request", async () => {
    const fetch = store();
    const { ctx, runMutation } = context({ amazonRtnTopicArn: undefined });
    await expect(
      ingestAmazonRtnHandler(ctx, {
        apiKey: "publishable",
        rawEnvelope: JSON.stringify(fixture.v2),
      }),
    ).rejects.toMatchObject({ data: { code: "AMAZON_RTN_NOT_CONFIGURED" } });
    expect(fetch).not.toHaveBeenCalled();
    expect(runMutation).not.toHaveBeenCalled();
    await expect(
      ingestAmazonRtnHandler(
        {
          runQuery: async () => {
            throw new ConvexError({ code: "INVALID_API_KEY" });
          },
        } as never,
        { apiKey: "secret", rawEnvelope: JSON.stringify(fixture.v2) },
      ),
    ).rejects.toMatchObject({ data: { code: "INVALID_API_KEY" } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a signed immediate replacement checks both receipts before one commit", async () => {
    const { ctx, runMutation } = context();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        if (fetchUrl(url).endsWith(".pem"))
          return new Response(fixture.certificate);
        if (fetchUrl(url).endsWith("old-receipt"))
          return new Response("gone", { status: 410 });
        return new Response(
          JSON.stringify({
            receiptId: "receipt-1",
            productId: "premium",
            productType: "SUBSCRIPTION",
            cancelDate: null,
          }),
        );
      });
    await ingestAmazonRtnHandler(ctx, {
      apiKey: "publishable",
      rawEnvelope: JSON.stringify(fixture.immediate),
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(runMutation.mock.calls.at(-1)?.[1]).toMatchObject({
      relatedReceipt: {
        state: "CANCELED",
        requestData: { receiptId: "old-receipt" },
      },
    });
    expect(
      runMutation.mock.calls.filter(([ref]) =>
        getFunctionName(ref).endsWith("applyAmazonRtnVerdict"),
      ),
    ).toHaveLength(1);
  });
});
