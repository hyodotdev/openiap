import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";

import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
} from "@apple/app-store-server-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APPLE_STATUS_LOOKUP_DEADLINE_MS,
  assertVerifiedTransactionBinding,
  fetchLatestAppleTransaction,
  isVerifierOutage,
  recordAppStoreVerifiedSubscription,
} from "./ios";
import {
  applyExpectedProductId,
  AppStoreProductType,
  type AppStoreReceiptData,
  mapToAppStoreReceiptResponse,
} from "./shared";
import { HarmonizedPurchaseState } from "./purchaseState";
import type { Id } from "../_generated/dataModel";

describe("App Store mappings (real data)", () => {
  it("treats non-consumable purchase as entitled", () => {
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "60002463315105",
      originalTransactionId: "60002463315105",
      bundleId: "com.gotterdammerung.untold.ios",
      productId: "untold_full_premium",
      purchaseDate: 1749823893000,
      originalPurchaseDate: 1749823893000,
      quantity: 1,
      type: "Non-Consumable",
      price: 5990,
      currency: "USD",
      storefront: "USA",
      storefrontId: "143441",
      environment: "Production",
      inAppOwnershipType: "PURCHASED",
      signedDate: 1765006915846,
      transactionReason: "PURCHASE",
      appTransactionId: "704587545466907739",
    });

    expect(receipt).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.ENTITLED,
      productId: "untold_full_premium",
      environment: "Production",
    });
  });

  it("treats consumable purchase as ready to consume", () => {
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001013981797",
      originalTransactionId: "2000001013981797",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.10bulbs",
      purchaseDate: 1758057259000,
      originalPurchaseDate: 1758057259000,
      quantity: 1,
      type: "Consumable",
      price: 9000,
      currency: "SEK",
      storefront: "SWE",
      storefrontId: "143456",
      environment: "Sandbox",
      inAppOwnershipType: "PURCHASED",
      signedDate: 1765025940929,
      transactionReason: "PURCHASE",
      appTransactionId: "704857133985478242",
    });

    expect(receipt).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.READY_TO_CONSUME,
      productId: "dev.hyo.martie.10bulbs",
      environment: "Sandbox",
    });
  });

  it("treats valid auto-renewable subscription as entitled", () => {
    const now = Date.now();
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001075170530",
      originalTransactionId: "2000000996303915",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.premium",
      purchaseDate: now - 86400000, // 1 day ago
      originalPurchaseDate: now - 86400000 * 10, // 10 days ago
      quantity: 1,
      type: "Auto-Renewable Subscription",
      price: 14000000,
      currency: "KRW",
      storefront: "KOR",
      storefrontId: "143466",
      environment: "Sandbox",
      webOrderLineItemId: "2000000120963779",
      subscriptionGroupIdentifier: "21686373",
      expiresDate: now + 86400000, // 1 day in the future
      inAppOwnershipType: "PURCHASED",
      signedDate: now,
      transactionReason: "PURCHASE",
      appTransactionId: "704794367555291146",
    });

    expect(receipt).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.ENTITLED,
      productId: "dev.hyo.martie.premium",
      environment: "Sandbox",
    });
  });

  it("treats expired auto-renewable subscription as expired", () => {
    const now = Date.now();
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001075170530",
      originalTransactionId: "2000000996303915",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.premium",
      purchaseDate: now - 86400000 * 2, // 2 days ago
      originalPurchaseDate: now - 86400000 * 10, // 10 days ago
      quantity: 1,
      type: "Auto-Renewable Subscription",
      price: 14000000,
      currency: "KRW",
      storefront: "KOR",
      storefrontId: "143466",
      environment: "Sandbox",
      webOrderLineItemId: "2000000120963779",
      subscriptionGroupIdentifier: "21686373",
      expiresDate: now - 86400000, // 1 day in the past (expired)
      inAppOwnershipType: "PURCHASED",
      signedDate: now,
      transactionReason: "PURCHASE",
      appTransactionId: "704794367555291146",
    });

    expect(receipt).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.EXPIRED,
      productId: "dev.hyo.martie.premium",
      environment: "Sandbox",
    });
  });

  it("treats revoked transaction as canceled", () => {
    const now = Date.now();
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001075170530",
      originalTransactionId: "2000000996303915",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.premium",
      purchaseDate: now - 86400000 * 2,
      originalPurchaseDate: now - 86400000 * 10,
      quantity: 1,
      type: "Auto-Renewable Subscription",
      price: 14000000,
      currency: "KRW",
      storefront: "KOR",
      storefrontId: "143466",
      environment: "Sandbox",
      webOrderLineItemId: "2000000120963779",
      subscriptionGroupIdentifier: "21686373",
      expiresDate: now + 86400000,
      revocationDate: now - 1000,
      revocationReason: 0,
      inAppOwnershipType: "PURCHASED",
      signedDate: now,
      transactionReason: "PURCHASE",
      appTransactionId: "704794367555291146",
    });

    expect(receipt).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.CANCELED,
      productId: "dev.hyo.martie.premium",
      environment: "Sandbox",
    });
  });

  it("treats a non-consumable without a transaction reason as entitled", () => {
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "60002463315105",
      originalTransactionId: "60002463315105",
      bundleId: "com.gotterdammerung.untold.ios",
      productId: "untold_full_premium",
      type: "Non-Consumable",
      environment: "Production",
    });

    expect(receipt).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.ENTITLED,
      productId: "untold_full_premium",
      environment: "Production",
    });
  });

  it("treats a consumable without a transaction reason as ready to consume", () => {
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001013981797",
      originalTransactionId: "2000001013981797",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.10bulbs",
      type: "Consumable",
      environment: "Sandbox",
    });

    expect(receipt).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.READY_TO_CONSUME,
      productId: "dev.hyo.martie.10bulbs",
      environment: "Sandbox",
    });
  });

  it("fails closed on an unrecognized transaction reason", () => {
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001013981797",
      originalTransactionId: "2000001013981797",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.10bulbs",
      type: "Consumable",
      environment: "Sandbox",
      transactionReason: "SOME_NEW_REASON",
    });

    expect(receipt).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.UNKNOWN,
      productId: "dev.hyo.martie.10bulbs",
      environment: "Sandbox",
    });
  });

  it("marks a valid receipt inauthentic when expectedProductId mismatches", () => {
    const receipt = applyExpectedProductId(
      {
        isValid: true,
        state: HarmonizedPurchaseState.ENTITLED,
        productId: "dev.hyo.martie.premium",
        environment: "Sandbox",
      },
      "dev.hyo.martie.coins",
    );

    expect(receipt).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.INAUTHENTIC,
      productId: "dev.hyo.martie.premium",
      environment: "Sandbox",
    });
  });
});

describe("recordAppStoreVerifiedSubscription", () => {
  // `legacyProductId`: the product of a row stored without a purchase date.
  function makeRunMutationRecorder(legacyProductId: string | null = null) {
    const runMutation = vi.fn();
    const runQuery = vi.fn().mockResolvedValue(legacyProductId);
    const calls = (): Record<string, unknown>[] =>
      runMutation.mock.calls.map((call) => call[1] as Record<string, unknown>);
    return { ctx: { runMutation, runQuery }, calls };
  }
  const noLatest = vi.fn(async () => null);
  const subscription = (
    productId: string,
    extra: Partial<AppStoreReceiptData> = {},
  ): AppStoreReceiptData => ({
    transactionId: `${productId}-transaction`,
    originalTransactionId: "original-transaction-1",
    bundleId: "dev.hyo.martie",
    productId,
    type: AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION,
    environment: "Production",
    ...extra,
  });

  it("records subscription transactions with store-verified state and micros pricing", async () => {
    const { ctx, calls } = makeRunMutationRecorder();

    await recordAppStoreVerifiedSubscription(ctx, {
      latestTransaction: noLatest,
      projectId: "projects_1" as Id<"projects">,
      remoteId: "original-transaction-1",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      transactionData: {
        transactionId: "transaction-1",
        originalTransactionId: "original-transaction-1",
        bundleId: "dev.hyo.martie",
        productId: "dev.hyo.martie.premium",
        type: AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION,
        environment: "Sandbox",
        purchaseDate: 1_767_225_600_000,
        expiresDate: 1_769_904_000_000,
        currency: "USD",
        price: 9990,
      },
    });

    expect(calls()).toHaveLength(1);
    expect(calls()[0]).toMatchObject({
      verifiedPurchaseDate: 1_767_225_600_000,
      projectId: "projects_1",
      platform: "IOS",
      purchaseToken: "original-transaction-1",
      productId: "dev.hyo.martie.premium",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      expiresAt: 1_769_904_000_000,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });
  });

  it("skips non-subscription transactions", async () => {
    const { ctx, calls } = makeRunMutationRecorder();

    await recordAppStoreVerifiedSubscription(ctx, {
      latestTransaction: noLatest,
      projectId: "projects_1" as Id<"projects">,
      remoteId: "transaction-1",
      purchaseState: HarmonizedPurchaseState.READY_TO_CONSUME,
      transactionData: {
        transactionId: "transaction-1",
        bundleId: "dev.hyo.martie",
        productId: "dev.hyo.martie.10bulbs",
        type: AppStoreProductType.CONSUMABLE,
        environment: "Sandbox",
        currency: "USD",
        price: 9990,
      },
    });

    expect(calls()).toHaveLength(0);
  });

  it("keeps non-renewing passes as purchases, never expiry-less subscription rows", async () => {
    const { ctx, calls } = makeRunMutationRecorder();
    const yearAgo = Date.now() - 365 * 86_400_000;
    const transactionData = {
      transactionId: "pass-1",
      originalTransactionId: "pass-1",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.pass_1m",
      type: AppStoreProductType.NON_RENEWING_SUBSCRIPTION,
      transactionReason: "PURCHASE",
      purchaseDate: yearAgo,
      environment: "Production" as const,
    };

    // The /v1 verdict is unchanged; only the subscription ledger skips it.
    expect(mapToAppStoreReceiptResponse(transactionData).state).toBe(
      HarmonizedPurchaseState.ENTITLED,
    );
    await recordAppStoreVerifiedSubscription(ctx, {
      latestTransaction: noLatest,
      projectId: "projects_1" as Id<"projects">,
      remoteId: "pass-1",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      transactionData,
    });

    expect(calls()).toHaveLength(0);
  });

  it("records Apple's latest when a legacy row meets another plan: a newer refunded monthly", async () => {
    const { ctx, calls } = makeRunMutationRecorder("basic_yearly");
    const latest = subscription("pro_monthly", {
      purchaseDate: 2_000,
      expiresDate: 3_000,
      revocationDate: 2_500,
      transactionReason: "PURCHASE",
    });

    await recordAppStoreVerifiedSubscription(ctx, {
      latestTransaction: async () => ({
        transaction: latest,
        inGracePeriod: false,
      }),
      projectId: "projects_1" as Id<"projects">,
      remoteId: "original-transaction-1",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      transactionData: subscription("pro_monthly_trial"),
    });

    expect(calls()).toEqual([
      expect.objectContaining({
        productId: "pro_monthly",
        purchaseState: HarmonizedPurchaseState.CANCELED,
        expiresAt: 3_000,
        verifiedPurchaseDate: 2_000,
        authoritative: true,
      }),
    ]);
  });

  it("records Apple's current plan when a legacy row meets a replayed old plan", async () => {
    const { ctx, calls } = makeRunMutationRecorder("pro_monthly");
    const future = Date.now() + 86_400_000;

    await recordAppStoreVerifiedSubscription(ctx, {
      latestTransaction: async () => ({
        transaction: subscription("pro_monthly", {
          purchaseDate: 2_000,
          expiresDate: future,
          transactionReason: "RENEWAL",
        }),
        inGracePeriod: false,
      }),
      projectId: "projects_1" as Id<"projects">,
      remoteId: "original-transaction-1",
      purchaseState: HarmonizedPurchaseState.EXPIRED,
      transactionData: subscription("basic_yearly", { expiresDate: 1_000 }),
    });

    expect(calls()).toEqual([
      expect.objectContaining({
        productId: "pro_monthly",
        purchaseState: HarmonizedPurchaseState.ENTITLED,
        expiresAt: future,
        authoritative: true,
      }),
    ]);
  });

  it("records billing grace from Apple's status, not the elapsed paid period", async () => {
    const { ctx, calls } = makeRunMutationRecorder("basic_yearly");
    const graceEnds = Date.now() + 86_400_000;

    await recordAppStoreVerifiedSubscription(ctx, {
      latestTransaction: async () => ({
        transaction: subscription("pro_monthly", {
          purchaseDate: 2_000,
          expiresDate: Date.now() - 86_400_000,
          transactionReason: "RENEWAL",
        }),
        inGracePeriod: true,
        graceExpiresAt: graceEnds,
      }),
      projectId: "projects_1" as Id<"projects">,
      remoteId: "original-transaction-1",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      transactionData: subscription("pro_monthly_old"),
    });

    expect(calls()).toEqual([
      expect.objectContaining({
        productId: "pro_monthly",
        purchaseState: HarmonizedPurchaseState.ENTITLED,
        subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
        expiresAt: graceEnds,
        authoritative: true,
      }),
    ]);
  });

  it("leaves a legacy row unchanged when Apple's status cannot be read", async () => {
    const { ctx, calls } = makeRunMutationRecorder("basic_yearly");

    await recordAppStoreVerifiedSubscription(ctx, {
      latestTransaction: noLatest,
      projectId: "projects_1" as Id<"projects">,
      remoteId: "original-transaction-1",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      transactionData: subscription("pro_monthly"),
    });

    expect(calls()).toHaveLength(0);
  });
});

describe("fetchLatestAppleTransaction", () => {
  afterEach(() => vi.useRealTimers());

  it("gives up on a status request that never settles", async () => {
    vi.useFakeTimers();
    const result = fetchLatestAppleTransaction(
      { getAllSubscriptionStatuses: () => new Promise(() => {}) },
      {
        originalTransactionId: "original-transaction-1",
        bundleId: "dev.hyo.martie",
        environment: Environment.PRODUCTION,
      },
    );

    await vi.advanceTimersByTimeAsync(APPLE_STATUS_LOOKUP_DEADLINE_MS);

    await expect(result).resolves.toBeNull();
  });
});

describe("assertVerifiedTransactionBinding", () => {
  const verified = {
    transactionId: "2000001177054625",
    bundleId: "dev.hyo.martie",
    environment: "Production" as const,
  };

  it("accepts a response matching the request on all three fields", () => {
    expect(() =>
      assertVerifiedTransactionBinding({
        requestedTransactionId: "2000001177054625",
        requestedEnvironment: "Production",
        expectedBundleId: "dev.hyo.martie",
        verified,
      }),
    ).not.toThrow();
  });

  it("rejects a transaction id drift", () => {
    expect(() =>
      assertVerifiedTransactionBinding({
        requestedTransactionId: "9999999999999999",
        requestedEnvironment: "Production",
        expectedBundleId: "dev.hyo.martie",
        verified,
      }),
    ).toThrow(/transactionId/);
  });

  it("rejects a bundle id that is not the project's", () => {
    expect(() =>
      assertVerifiedTransactionBinding({
        requestedTransactionId: "2000001177054625",
        requestedEnvironment: "Production",
        expectedBundleId: "dev.other.app",
        verified,
      }),
    ).toThrow(/bundleId/);
  });

  it("rejects an environment drift", () => {
    expect(() =>
      assertVerifiedTransactionBinding({
        requestedTransactionId: "2000001177054625",
        requestedEnvironment: "Sandbox",
        expectedBundleId: "dev.hyo.martie",
        verified,
      }),
    ).toThrow(/environment/);
  });
});

// Runs the real @apple/app-store-server-library verifier against a throwaway
// CA whose certificates point their OCSP URL at a local server.
describe("isVerifierOutage (real verifier)", () => {
  interface Jsrsasign {
    KJUR: {
      asn1: {
        x509: {
          Certificate: new (params: Record<string, unknown>) => {
            getPEM: () => string;
          };
        };
      };
    };
  }
  const libraryRequire = createRequire(
    createRequire(import.meta.url).resolve("@apple/app-store-server-library"),
  );
  const jsrsasign: Jsrsasign = libraryRequire("jsrsasign");
  let server: Server | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  async function ocspResponder(): Promise<string> {
    server = createServer((request, response) => {
      request.resume();
      response.writeHead(503, { "content-type": "text/html" });
      response.end("<html><body>503 Service Unavailable</body></html>");
    });
    await new Promise<void>((resolve) =>
      server?.listen(0, "127.0.0.1", resolve),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/ocsp`;
  }

  function signedTransaction(ocspUrl: string, forged = false) {
    const key = () => generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pem = (k: KeyObject, type: "spki" | "pkcs8") =>
      k.export({ type, format: "pem" }).toString();
    const root = key();
    const intermediate = key();
    const leaf = key();
    const certificate = (
      subject: string,
      issuer: string,
      publicKey: KeyObject,
      caKey: KeyObject,
      ext: unknown[],
    ) =>
      new jsrsasign.KJUR.asn1.x509.Certificate({
        version: 3,
        serial: { int: 1 },
        issuer: { str: issuer },
        subject: { str: subject },
        notbefore: "250101000000Z",
        notafter: "350101000000Z",
        sbjpubkey: pem(publicKey, "spki"),
        ext,
        sigalg: "SHA256withECDSA",
        cakey: pem(caKey, "pkcs8"),
      }).getPEM();
    const ca = { extname: "basicConstraints", critical: true, cA: true };
    const ocsp = { extname: "authorityInfoAccess", array: [{ ocsp: ocspUrl }] };
    const rootPem = certificate(
      "/CN=Root",
      "/CN=Root",
      root.publicKey,
      root.privateKey,
      [ca],
    );
    const intermediatePem = certificate(
      "/CN=Intermediate",
      "/CN=Root",
      intermediate.publicKey,
      root.privateKey,
      [ca, ocsp, { extname: "1.2.840.113635.100.6.2.1", extn: "0500" }],
    );
    const leafPem = certificate(
      "/CN=Leaf",
      "/CN=Intermediate",
      leaf.publicKey,
      intermediate.privateKey,
      [ocsp, { extname: "1.2.840.113635.100.6.11.1", extn: "0500" }],
    );
    const der = (value: string) =>
      Buffer.from(value.replace(/-----[^-]+-----|\s/g, ""), "base64");
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const input = `${encode({
      alg: "ES256",
      x5c: [leafPem, intermediatePem, rootPem].map((value) =>
        der(value).toString("base64"),
      ),
    })}.${encode({
      transactionId: "1",
      bundleId: "dev.hyo.martie",
      environment: "Sandbox",
      signedDate: Date.now(),
    })}`;
    const signer = forged ? key().privateKey : leaf.privateKey;
    const signature = sign("sha256", Buffer.from(input), {
      key: signer,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
    return { jws: `${input}.${signature}`, root: der(rootPem) };
  }

  async function verifierError(
    jws: string,
    root: Buffer,
    onlineChecks: boolean,
  ): Promise<unknown> {
    const verifier = new SignedDataVerifier(
      [root],
      onlineChecks,
      Environment.SANDBOX,
      "dev.hyo.martie",
    );
    return verifier.verifyAndDecodeTransaction(jws).then(
      () => undefined,
      (error: unknown) => error,
    );
  }

  it("treats a 503 page from the OCSP responder as an outage", async () => {
    const { jws, root } = signedTransaction(await ocspResponder());

    const error = await verifierError(jws, root, true);

    expect(error).toBeInstanceOf(VerificationException);
    expect(isVerifierOutage(error)).toBe(true);
  });

  it("treats an unreachable OCSP responder as an outage", async () => {
    const { jws, root } = signedTransaction("http://127.0.0.1:1/ocsp");

    expect(isVerifierOutage(await verifierError(jws, root, true))).toBe(true);
  });

  it("keeps a forged signature and a bad certificate permanent", async () => {
    const { jws, root } = signedTransaction("http://127.0.0.1:1/ocsp", true);

    const forged = await verifierError(jws, root, false);

    expect(forged).toBeInstanceOf(VerificationException);
    expect(isVerifierOutage(forged)).toBe(false);
    expect(
      isVerifierOutage(
        new VerificationException(VerificationStatus.INVALID_CERTIFICATE),
      ),
    ).toBe(false);
  });
});
