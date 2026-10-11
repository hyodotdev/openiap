import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/amazon-sns.json";
import {
  amazonSnsStringToSign,
  confirmAmazonSnsSubscription,
  parseAmazonRtnMessage,
  parseAmazonSnsEnvelope,
  verifyAmazonSnsEnvelope,
} from "./amazonSns";
import { parseAmazonSnsTopic } from "./amazonShared";

afterEach(() => vi.restoreAllMocks());

describe("Amazon SNS authentication", () => {
  it.each(["v1", "v2"] as const)(
    "verifies an actual RSA %s signature and bounds the certificate fetch",
    async (version) => {
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(fixture.certificate));
      const envelope = await verifyAmazonSnsEnvelope(
        JSON.stringify(fixture[version]),
        fixture.v2.TopicArn,
        fixture.now,
      );
      expect(envelope.SignatureVersion).toBe(version === "v1" ? "1" : "2");
      expect(fetch).toHaveBeenCalledWith(
        new URL(fixture.v2.SigningCertURL),
        expect.objectContaining({
          redirect: "error",
          signal: expect.any(AbortSignal),
        }),
      );
    },
  );

  it("rejects a modified signed message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fixture.certificate),
    );
    await expect(
      verifyAmazonSnsEnvelope(
        JSON.stringify({ ...fixture.v2, Message: "forged" }),
        fixture.v2.TopicArn,
        fixture.now,
      ),
    ).rejects.toThrow("signature verification failed");
  });

  it.each([
    "http://sns.us-east-1.amazonaws.com/SimpleNotificationService-fixture.pem",
    "https://sns.us-east-1.amazonaws.com.evil.example/SimpleNotificationService-fixture.pem",
    "https://sns.us-east-2.amazonaws.com/SimpleNotificationService-fixture.pem",
    "https://sns.us-east-1.amazonaws.com@127.0.0.1/SimpleNotificationService-fixture.pem",
    "https://sns.us-east-1.amazonaws.com:444/SimpleNotificationService-fixture.pem",
    "https://sns.us-east-1.amazonaws.com/other.pem",
    "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-fixture.pem?redirect=local",
  ])(
    "rejects untrusted certificate URL %s before fetching",
    async (SigningCertURL) => {
      const fetch = vi.spyOn(globalThis, "fetch");
      await expect(
        verifyAmazonSnsEnvelope(
          JSON.stringify({ ...fixture.v2, SigningCertURL }),
          fixture.v2.TopicArn,
          fixture.now,
        ),
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects another project's configured topic before fetching", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(
      verifyAmazonSnsEnvelope(
        JSON.stringify(fixture.v2),
        fixture.v2.TopicArn.replace("AmazonIAP", "AnotherApp"),
        fixture.now,
      ),
    ).rejects.toThrow("topic does not match");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects envelopes past dedup retention and far in the future", () => {
    const raw = JSON.stringify(fixture.v2);
    expect(() =>
      parseAmazonSnsEnvelope(raw, fixture.now + 31 * 86400000),
    ).toThrow("replay window");
    expect(() => parseAmazonSnsEnvelope(raw, fixture.now - 6 * 60000)).toThrow(
      "replay window",
    );
  });

  it("bounds certificate response bodies and preserves retryable network failures", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("x".repeat(65537)))
      .mockRejectedValueOnce(new TypeError("network down"));
    const raw = JSON.stringify(fixture.v2);
    await expect(
      verifyAmazonSnsEnvelope(raw, fixture.v2.TopicArn, fixture.now),
    ).rejects.toThrow("too large");
    await expect(
      verifyAmazonSnsEnvelope(raw, fixture.v2.TopicArn, fixture.now),
    ).rejects.toThrow("network down");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("signs confirmation fields in canonical order, including its token and URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fixture.certificate),
    );
    const envelope = await verifyAmazonSnsEnvelope(
      JSON.stringify(fixture.confirmation),
      fixture.v2.TopicArn,
      fixture.now,
    );
    expect(amazonSnsStringToSign(envelope)).toContain(
      `SubscribeURL\n${fixture.confirmation.SubscribeURL}\nTimestamp\n`,
    );
    expect(amazonSnsStringToSign(envelope)).toContain(
      "Token\nfixture-token\nTopicArn\n",
    );
  });

  it("confirms only the exact signed SNS topic and token", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("confirmed"));
    const envelope = parseAmazonSnsEnvelope(
      JSON.stringify(fixture.confirmation),
      fixture.now,
    );
    await confirmAmazonSnsSubscription(envelope);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(
      confirmAmazonSnsSubscription({ ...envelope, Token: "other-token" }),
    ).rejects.toThrow("does not match");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects ambiguous confirmation query parameters before the confirmation request", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const envelope = parseAmazonSnsEnvelope(
      JSON.stringify(fixture.confirmation),
      fixture.now,
    );
    await expect(
      confirmAmazonSnsSubscription({
        ...envelope,
        SubscribeURL: `${envelope.SubscribeURL}&Token=another`,
      }),
    ).rejects.toThrow("does not match");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Amazon RTN application binding", () => {
  it("keeps LAT as a test marker, without changing its RVS endpoint", () => {
    const envelope = parseAmazonSnsEnvelope(
      JSON.stringify(fixture.v2),
      fixture.now,
    );
    expect(
      parseAmazonRtnMessage(envelope, "dev.hyo.martie", fixture.now),
    ).toMatchObject({ betaProductTransaction: true, receiptId: "receipt-1" });
    expect(() =>
      parseAmazonRtnMessage(envelope, "another.app", fixture.now),
    ).toThrow("app package does not match");
  });

  it("accepts future notification types and related cancelled receipts for fresh RVS checks", () => {
    const envelope = parseAmazonSnsEnvelope(
      JSON.stringify(fixture.v2),
      fixture.now,
    );
    const message = JSON.parse(envelope.Message) as Record<string, unknown>;
    envelope.Message = JSON.stringify({
      ...message,
      notificationType: "FUTURE_TYPE",
      relatedReceipts: { cancelledReceiptId: "old-receipt" },
    });
    expect(
      parseAmazonRtnMessage(envelope, "dev.hyo.martie", fixture.now),
    ).toMatchObject({
      notificationType: "FUTURE_TYPE",
      relatedReceipts: { cancelledReceiptId: "old-receipt" },
    });
  });

  it("rejects malformed messages before any RVS call", () => {
    const envelope = parseAmazonSnsEnvelope(
      JSON.stringify(fixture.v2),
      fixture.now,
    );
    const message = JSON.parse(envelope.Message) as Record<string, unknown>;
    for (const invalid of [
      { receiptId: "" },
      { appUserId: "x".repeat(129) },
      { timestamp: "1" },
      { betaProductTransaction: "true" },
      { relatedReceipts: [] },
    ]) {
      expect(() =>
        parseAmazonRtnMessage(
          { ...envelope, Message: JSON.stringify({ ...message, ...invalid }) },
          "dev.hyo.martie",
          fixture.now,
        ),
      ).toThrow();
    }
  });

  it("accepts only standard AWS SNS topic ARNs", () => {
    expect(parseAmazonSnsTopic(fixture.v2.TopicArn)?.origin).toBe(
      "https://sns.us-east-1.amazonaws.com",
    );
    for (const invalid of [
      "https://localhost",
      "arn:aws:sns:us-east-1:123:topic",
      `${fixture.v2.TopicArn}.fifo`,
      `${fixture.v2.TopicArn}/other`,
    ])
      expect(parseAmazonSnsTopic(invalid)).toBeNull();
  });
});
