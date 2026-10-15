import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { readGooglePurchase } from "./action";

const TOKEN = "play-token-SECRET";

// A Play client whose product and subscription lookups both fail.
function failingPublisher(status: number, message: string) {
  const fail = async () => {
    throw Object.assign(new Error(message), { code: status });
  };
  return {
    purchases: {
      productsv2: { getproductpurchasev2: fail },
      subscriptionsv2: { get: fail },
    },
  } as never;
}

async function resyncError(status: number, message: string) {
  const error = await readGooglePurchase(failingPublisher(status, message), {
    packageName: "dev.example",
    purchaseToken: TOKEN,
    expectedProductId: undefined,
  }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ConvexError);
  return error as ConvexError<{ code: string; message: string }>;
}

describe("readGooglePurchase", () => {
  it("answers NOT_FOUND for a token Google revoked", async () => {
    const error = await resyncError(
      410,
      "The purchase token is no longer valid.",
    );
    expect(error.data.code).toBe("NOT_FOUND");
  });

  it("never returns Google's own text, which can carry the token", async () => {
    const error = await resyncError(
      400,
      `Request failed: GET /purchases/subscriptionsv2/tokens/${TOKEN}`,
    );
    expect(error.data).toEqual({
      code: "STORE_REQUEST_FAILED",
      message: "Purchase verification failed (HTTP 400)",
    });
    expect(JSON.stringify(error.data)).not.toContain(TOKEN);
  });
});
