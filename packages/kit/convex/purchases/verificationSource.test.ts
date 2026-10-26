import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Infer } from "convex/values";
import { testableFunction } from "../test.setup";
import { verifyAppStoreReceiptInternalV1 as apple } from "./ios";
import { verifyGooglePlayReceiptInternalV1 as google } from "./android";
import { verifyAmazonReceiptInternalV1 as amazon } from "./amazon";
import { verifyMetaHorizonReceiptInternalV1 as horizon } from "./horizon";
import {
  verifyAppStoreReceipt as appleAlias,
  verifyGooglePlayReceipt as googleAlias,
  verifyAmazonReceipt as amazonAlias,
} from "./action";
import {
  assertVerificationSource,
  verificationSourceValidator,
  withVerificationSource,
} from "./verificationSource";

type Proof = Infer<typeof verificationSourceValidator>;
const appleArgs = {
  apiKey: "openiap-kit_pk_fixture",
  jws: "synthetic-jws",
  expectedProductId: "product",
  requestIp: "192.0.2.1",
  correlationId: "fixture-correlation",
};
const googleArgs = {
  apiKey: appleArgs.apiKey,
  purchaseToken: "synthetic-play-token",
};
const amazonArgs = {
  apiKey: appleArgs.apiKey,
  userId: "fixture-user",
  receiptId: "synthetic-receipt",
  sandbox: true,
};
const horizonArgs = {
  apiKey: appleArgs.apiKey,
  userId: "fixture-user",
  sku: "product",
};
const entries = [
  {
    name: "apple",
    call: (ctx: unknown, sourceAuth?: Proof) =>
      testableFunction(apple)._handler(ctx, { ...appleArgs, sourceAuth }),
  },
  {
    name: "google",
    call: (ctx: unknown, sourceAuth?: Proof) =>
      testableFunction(google)._handler(ctx, { ...googleArgs, sourceAuth }),
  },
  {
    name: "amazon",
    call: (ctx: unknown, sourceAuth?: Proof) =>
      testableFunction(amazon)._handler(ctx, { ...amazonArgs, sourceAuth }),
  },
  {
    name: "horizon",
    call: (ctx: unknown, sourceAuth?: Proof) =>
      testableFunction(horizon)._handler(ctx, { ...horizonArgs, sourceAuth }),
  },
  {
    name: "apple-alias",
    call: (ctx: unknown, sourceAuth?: Proof) =>
      testableFunction(appleAlias)._handler(ctx, { ...appleArgs, sourceAuth }),
  },
  {
    name: "google-alias",
    call: (ctx: unknown, sourceAuth?: Proof) =>
      testableFunction(googleAlias)._handler(ctx, {
        ...googleArgs,
        sourceAuth,
      }),
  },
  {
    name: "amazon-alias",
    call: (ctx: unknown, sourceAuth?: Proof) =>
      testableFunction(amazonAlias)._handler(ctx, {
        ...amazonArgs,
        sourceAuth,
      }),
  },
];

beforeEach(() =>
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "2".repeat(64)),
);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("verification source boundary", () => {
  it.each(["apple", "enqueue", "read"] as const)(
    "keeps the %s source domain and signed bytes unchanged",
    (scope) => {
      vi.spyOn(Date, "now").mockReturnValue(1_000_000);
      const args = { z: "last", a: "first", omitted: undefined };
      const proof = withVerificationSource(scope, args).sourceAuth;
      const domain =
        scope === "apple"
          ? "iapkit-verification-v1"
          : "iapkit-verification-job-v1";
      const expected = createHmac("sha256", "2".repeat(64))
        .update(
          JSON.stringify([
            domain,
            scope,
            1_000_000,
            [
              ["a", "first"],
              ["z", "last"],
            ],
          ]),
        )
        .digest("hex");
      expect(proof.mac).toBe(expected);
      expect(() => assertVerificationSource(scope, args, proof)).not.toThrow();
      for (const other of ["apple", "enqueue", "read"] as const) {
        if (other !== scope)
          expect(() => assertVerificationSource(other, args, proof)).toThrow();
      }
    },
  );

  it.each(["enqueue", "read"] as const)(
    "%s preserves structured queue errors for invalid proofs and missing configuration",
    (scope) => {
      const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
      const args = { apiKey: "fixture", idempotencyKey: "a".repeat(64) };
      const proof = withVerificationSource(scope, args).sourceAuth;
      for (const malformed of [
        undefined,
        { ...proof, mac: "z".repeat(64) },
        { ...proof, mac: "0".repeat(65) },
        { ...proof, issuedAt: 879_999 },
        { ...proof, issuedAt: 1_030_001 },
      ]) {
        expect(() => assertVerificationSource(scope, args, malformed)).toThrow(
          "UNKNOWN_ERROR",
        );
      }
      now.mockReturnValue(1_120_000);
      expect(() => assertVerificationSource(scope, args, proof)).not.toThrow();
      now.mockReturnValue(1_120_001);
      expect(() => assertVerificationSource(scope, args, proof)).toThrow(
        "UNKNOWN_ERROR",
      );
      for (const secret of [undefined, "short"]) {
        vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", secret);
        expect(() => withVerificationSource(scope, args)).toThrow(
          "UNKNOWN_ERROR",
        );
        expect(() => assertVerificationSource(scope, args, proof)).toThrow(
          "UNKNOWN_ERROR",
        );
      }
    },
  );

  it.each(entries)(
    "$name rejects a public key without valid service proof before any I/O",
    async ({ call }) => {
      const ctx = {
        runQuery: vi.fn(),
        runMutation: vi.fn(),
        runAction: vi.fn(),
      };
      for (const proof of [
        undefined,
        { issuedAt: Date.now(), mac: "0".repeat(64) },
      ]) {
        await expect(call(ctx, proof)).rejects.toMatchObject({
          errorCode: "UNKNOWN_ERROR",
          retryAfterSec: 5,
        });
      }
      expect(ctx.runQuery).not.toHaveBeenCalled();
      expect(ctx.runMutation).not.toHaveBeenCalled();
      expect(ctx.runAction).not.toHaveBeenCalled();
    },
  );

  it("binds the proof to exact operation, evidence, key and trusted metadata", () => {
    const { sourceAuth } = withVerificationSource("apple", appleArgs);
    expect(() =>
      assertVerificationSource("apple", { ...appleArgs }, sourceAuth),
    ).not.toThrow();
    for (const delta of [
      { apiKey: "other-project" },
      { jws: "other-jws" },
      { expectedProductId: "other-product" },
      { requestIp: "192.0.2.2" },
      { correlationId: "other-correlation" },
    ]) {
      expect(() =>
        assertVerificationSource(
          "apple",
          { ...appleArgs, ...delta },
          sourceAuth,
        ),
      ).toThrow();
    }
    expect(() =>
      assertVerificationSource("google", appleArgs, sourceAuth),
    ).toThrow();
    const signedAmazon = withVerificationSource("amazon", amazonArgs);
    expect(() =>
      assertVerificationSource(
        "amazon",
        { ...amazonArgs, sandbox: false },
        signedAmazon.sourceAuth,
      ),
    ).toThrow();
  });

  it("rejects expired, future, malformed and missing source configuration", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const { sourceAuth } = withVerificationSource("apple", appleArgs);
    now.mockReturnValue(1_120_001);
    expect(() =>
      assertVerificationSource("apple", appleArgs, sourceAuth),
    ).toThrow();
    now.mockReturnValue(969_999);
    expect(() =>
      assertVerificationSource("apple", appleArgs, sourceAuth),
    ).toThrow();
    now.mockReturnValue(1_000_000);
    for (const mac of ["", "z".repeat(64), "0".repeat(65)])
      expect(() =>
        assertVerificationSource("apple", appleArgs, { ...sourceAuth, mac }),
      ).toThrow();
    for (const secret of [undefined, "short"]) {
      vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", secret);
      expect(() => withVerificationSource("apple", appleArgs)).toThrow();
      expect(() =>
        assertVerificationSource("apple", appleArgs, sourceAuth),
      ).toThrow();
    }
  });

  it("a valid service proof still rejects an unknown customer key", async () => {
    const ctx = {
      runQuery: vi.fn(async () => null),
      runMutation: vi.fn(),
      runAction: vi.fn(),
    };
    const { sourceAuth } = withVerificationSource("google", googleArgs);
    await expect(
      testableFunction(google)._handler(ctx, { ...googleArgs, sourceAuth }),
    ).rejects.toMatchObject({ errorCode: "INVALID_API_KEY" });
    expect(ctx.runQuery).toHaveBeenCalled();
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(ctx.runAction).not.toHaveBeenCalled();
  });
});
