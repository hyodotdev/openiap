import { withVerificationSource } from "./verificationSource";
import { Buffer } from "node:buffer";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appleMocks = vi.hoisted(() => ({
  apiClientConstructor: vi.fn(),
  getTransactionInfo: vi.fn(),
  verifierConstructor: vi.fn(),
  verifyAndDecodeTransaction: vi.fn(),
}));

vi.mock("@apple/app-store-server-library", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@apple/app-store-server-library")>();

  return {
    ...actual,
    AppStoreServerAPIClient: class {
      constructor(...args: unknown[]) {
        appleMocks.apiClientConstructor(...args);
      }

      getTransactionInfo(transactionId: string) {
        return appleMocks.getTransactionInfo(transactionId);
      }
    },
    SignedDataVerifier: class {
      constructor(...args: unknown[]) {
        appleMocks.verifierConstructor(...args);
      }

      verifyAndDecodeTransaction(jws: string) {
        return appleMocks.verifyAndDecodeTransaction(jws);
      }
    },
  };
});

import {
  APIException,
  Environment,
  VerificationException,
  VerificationStatus,
} from "@apple/app-store-server-library";
import { STORE_OUTAGE_RETRY_AFTER_SEC } from "./errors";
import { getFunctionName, type FunctionReference } from "convex/server";
import { testableFunction } from "../test.setup";
import { verifyAppStoreReceiptInternalV1 } from "./ios";

const verifyAppStoreReceipt = testableFunction(verifyAppStoreReceiptInternalV1);

const project = {
  _id: "projects_1",
  organizationId: "organizations_1",
  iosBundleId: "dev.hyo.martie",
  iosAppAppleId: 123456789,
  iosAppStoreIssuerId: "issuer-id",
  iosAppStoreKeyId: "key-id",
};

function compactJws(payload: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    Buffer.from("signature").toString("base64url"),
  ].join(".");
}

const APPLE_P8_KEY = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
}).privateKey;

const RSA_KEY = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
}).privateKey;

function context(p8Key = APPLE_P8_KEY) {
  return {
    runQuery: vi.fn(async (reference: FunctionReference<"query">) =>
      getFunctionName(reference) === "files/internal:getAppleP8KeyFile"
        ? { storageId: "storage_key" }
        : project,
    ),
    storage: { get: vi.fn().mockResolvedValue(new Blob([p8Key])) },
    runMutation: vi.fn().mockResolvedValue("purchases_1"),
  };
}

const verifiedTransaction = {
  transactionId: "2000001177054625",
  originalTransactionId: "2000001177054625",
  bundleId: "dev.hyo.martie",
  productId: "premium_forever",
  purchaseDate: 1_700_000_000_000,
  originalPurchaseDate: 1_700_000_000_000,
  quantity: 1,
  type: "Non-Consumable",
  environment: "Production",
};

describe("verifyAppStoreReceiptInternalV1 handler", () => {
  beforeEach(() => {
    appleMocks.apiClientConstructor.mockReset();
    appleMocks.getTransactionInfo.mockReset();
    appleMocks.verifierConstructor.mockReset();
    appleMocks.verifyAndDecodeTransaction.mockReset();
  });

  it("clamps an attacker-controlled Xcode claim and verifies the client JWS before the Server API call", async () => {
    const clientJws = compactJws({
      transactionId: verifiedTransaction.transactionId,
      bundleId: verifiedTransaction.bundleId,
      environment: "Xcode",
    });
    appleMocks.verifyAndDecodeTransaction.mockResolvedValue(
      verifiedTransaction,
    );
    appleMocks.getTransactionInfo.mockResolvedValue({
      signedTransactionInfo: "server.signed.transaction",
    });
    const ctx = context();

    await expect(
      verifyAppStoreReceipt._handler(
        ctx as never,
        withVerificationSource("apple", {
          apiKey: "openiap-kit_pk_mobile",
          jws: clientJws,
        }),
      ),
    ).resolves.toEqual({
      isValid: true,
      state: "ENTITLED",
      productId: "premium_forever",
      environment: "Production",
      transactionDetails: {
        transactionId: "2000001177054625",
        originalTransactionId: "2000001177054625",
      },
    });

    expect(appleMocks.verifierConstructor).toHaveBeenCalledTimes(2);
    for (const call of appleMocks.verifierConstructor.mock.calls) {
      expect(call[2]).toBe(Environment.PRODUCTION);
    }
    expect(appleMocks.verifyAndDecodeTransaction).toHaveBeenNthCalledWith(
      1,
      clientJws,
    );
    expect(appleMocks.getTransactionInfo).toHaveBeenCalledWith(
      verifiedTransaction.transactionId,
    );
    expect(
      appleMocks.verifyAndDecodeTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(appleMocks.getTransactionInfo.mock.invocationCallOrder[0]);
    // The key is selected for the `kid` the Server API JWT will carry.
    expect(ctx.runQuery).toHaveBeenCalledWith(expect.anything(), {
      projectId: project._id,
      purpose: "apple_p8_key",
      keyId: project.iosAppStoreKeyId,
    });
  });

  it("never asks the Server API about a client JWS that fails signature verification", async () => {
    const forgedJws = compactJws({
      transactionId: verifiedTransaction.transactionId,
      bundleId: verifiedTransaction.bundleId,
      environment: "Production",
    });
    appleMocks.verifyAndDecodeTransaction.mockRejectedValue(
      new Error("forged"),
    );
    const ctx = context();

    await expect(
      verifyAppStoreReceipt._handler(
        ctx as never,
        withVerificationSource("apple", {
          apiKey: "openiap-kit_pk_mobile",
          jws: forgedJws,
        }),
      ),
    ).rejects.toMatchObject({
      errorCode: "APP_STORE_TRANSACTION_VERIFICATION_FAILED",
    });

    expect(appleMocks.getTransactionInfo).not.toHaveBeenCalled();
    // Forged bytes are a verdict, but storing one row per forgery would let
    // anyone holding the publishable key grow the table.
    expect(savedVerdicts(ctx)).toHaveLength(0);
  });

  it("answers an OCSP outage on the client JWS as temporary and stores nothing", async () => {
    const clientJws = compactJws({
      transactionId: verifiedTransaction.transactionId,
      bundleId: verifiedTransaction.bundleId,
      environment: "Production",
    });
    appleMocks.verifyAndDecodeTransaction.mockRejectedValue(
      new VerificationException(
        VerificationStatus.VERIFICATION_FAILURE,
        Object.assign(new Error("request to ocsp failed, reason: hang up"), {
          name: "FetchError",
          code: "ECONNRESET",
        }),
      ),
    );
    const ctx = context();

    await expect(
      verifyAppStoreReceipt._handler(
        ctx as never,
        withVerificationSource("apple", {
          apiKey: "openiap-kit_pk_mobile",
          jws: clientJws,
        }),
      ),
    ).rejects.toMatchObject({
      errorCode: "APP_STORE_TRANSACTION_VERIFICATION_FAILED",
      retryAfterSec: STORE_OUTAGE_RETRY_AFTER_SEC,
    });
    expect(appleMocks.verifyAndDecodeTransaction).toHaveBeenCalledTimes(3);
    expect(savedVerdicts(ctx)).toHaveLength(0);
  });

  it("answers a Server API outage as temporary and stores nothing", async () => {
    const clientJws = compactJws({
      transactionId: verifiedTransaction.transactionId,
      bundleId: verifiedTransaction.bundleId,
      environment: "Production",
    });
    appleMocks.verifyAndDecodeTransaction.mockResolvedValue(
      verifiedTransaction,
    );
    appleMocks.getTransactionInfo.mockRejectedValue(new APIException(503));
    const ctx = context();

    await expect(
      verifyAppStoreReceipt._handler(
        ctx as never,
        withVerificationSource("apple", {
          apiKey: "openiap-kit_pk_mobile",
          jws: clientJws,
        }),
      ),
    ).rejects.toMatchObject({
      errorCode: "APP_STORE_TRANSACTION_VERIFICATION_FAILED",
      retryAfterSec: STORE_OUTAGE_RETRY_AFTER_SEC,
    });
    expect(savedVerdicts(ctx)).toHaveLength(0);
  });

  it.each([
    [
      "malformed",
      "-----BEGIN PRIVATE KEY-----\nnot a key\n-----END PRIVATE KEY-----",
    ],
    ["RSA", RSA_KEY],
  ])(
    "reports a %s .p8 as a credential error, not an outage",
    async (_kind, p8Key) => {
      appleMocks.verifyAndDecodeTransaction.mockResolvedValue(
        verifiedTransaction,
      );
      // The real client signs its JWT before any request.
      appleMocks.getTransactionInfo.mockImplementation(async (id: string) => {
        const { AppStoreServerAPIClient } = await vi.importActual<
          typeof import("@apple/app-store-server-library")
        >("@apple/app-store-server-library");
        const [key, keyId, issuerId, bundleId, environment] =
          appleMocks.apiClientConstructor.mock.calls[0];
        return new AppStoreServerAPIClient(
          key,
          keyId,
          issuerId,
          bundleId,
          environment,
        ).getTransactionInfo(id);
      });
      const ctx = context(p8Key);

      const failure = await verifyAppStoreReceipt
        ._handler(
          ctx as never,
          withVerificationSource("apple", {
            apiKey: "openiap-kit_pk_mobile",
            jws: productionClientJws(),
          }),
        )
        .catch((error: unknown) => error);

      expect(failure).toMatchObject({
        errorCode: "APP_STORE_SERVER_CREDENTIALS_MISSING",
        errorDetails: { missing: ["privateKey"] },
      });
      expect(failure).not.toHaveProperty("retryAfterSec", expect.anything());
      expect(savedVerdicts(ctx)).toHaveLength(0);
    },
  );

  it("answers only a failed request as an outage", async () => {
    appleMocks.verifyAndDecodeTransaction.mockResolvedValue(
      verifiedTransaction,
    );
    appleMocks.getTransactionInfo.mockRejectedValue(
      Object.assign(new Error("request to Apple failed, reason: refused"), {
        name: "FetchError",
        code: "ECONNREFUSED",
      }),
    );
    await expect(
      verifyAppStoreReceipt._handler(
        context() as never,
        withVerificationSource("apple", {
          apiKey: "openiap-kit_pk_mobile",
          jws: productionClientJws(),
        }),
      ),
    ).rejects.toMatchObject({
      errorCode: "APP_STORE_TRANSACTION_VERIFICATION_FAILED",
      retryAfterSec: STORE_OUTAGE_RETRY_AFTER_SEC,
    });

    // The library's own error for a 200 it cannot parse; retrying repeats it.
    appleMocks.getTransactionInfo.mockRejectedValue(
      new Error("Unexpected response body format"),
    );
    const failure = await verifyAppStoreReceipt
      ._handler(
        context() as never,
        withVerificationSource("apple", {
          apiKey: "openiap-kit_pk_mobile",
          jws: productionClientJws(),
        }),
      )
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({
      errorCode: "APP_STORE_TRANSACTION_VERIFICATION_FAILED",
    });
    expect(failure).not.toHaveProperty("retryAfterSec", expect.anything());
  });
});

function productionClientJws(): string {
  return compactJws({
    transactionId: verifiedTransaction.transactionId,
    bundleId: verifiedTransaction.bundleId,
    environment: "Production",
  });
}

// Receipt writes carry a state; the admission mutation does not.
function savedVerdicts(ctx: ReturnType<typeof context>): unknown[] {
  return ctx.runMutation.mock.calls.filter(
    (call) => (call[1] as { state?: unknown }).state !== undefined,
  );
}

// Synthetic service credential for this isolated verification transport fixture.
beforeEach(() =>
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64)),
);
afterEach(() => vi.unstubAllEnvs());
