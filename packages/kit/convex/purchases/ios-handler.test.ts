import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { Environment } from "@apple/app-store-server-library";
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

function context() {
  return {
    runQuery: vi.fn().mockResolvedValue(project),
    runAction: vi.fn().mockResolvedValue({ keyContent: "private-key" }),
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
      verifyAppStoreReceipt._handler(ctx as never, {
        apiKey: "openiap-kit_pk_mobile",
        jws: clientJws,
      }),
    ).resolves.toEqual({
      isValid: true,
      state: "ENTITLED",
      productId: "premium_forever",
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
      verifyAppStoreReceipt._handler(ctx as never, {
        apiKey: "openiap-kit_pk_mobile",
        jws: forgedJws,
      }),
    ).rejects.toMatchObject({
      errorCode: "APP_STORE_TRANSACTION_VERIFICATION_FAILED",
    });

    expect(appleMocks.getTransactionInfo).not.toHaveBeenCalled();
    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
  });
});
