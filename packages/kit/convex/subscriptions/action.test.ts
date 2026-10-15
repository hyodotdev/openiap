import { APIException, Environment } from "@apple/app-store-server-library";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import {
  readGooglePurchase,
  resyncDisputedSubscription,
  resyncFromStore,
  withAppleEnvironment,
} from "./action";

const TOKEN = "play-token-SECRET";
const PROJECT = "projects_1" as Id<"projects">;

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

describe("withAppleEnvironment", () => {
  const apple = {
    bundleId: "dev.example",
    appAppleId: 1,
    clientFor: () => ({}) as never,
  };
  const appleError = (
    known: "Production" | "Sandbox" | undefined,
    statuses: number[],
  ) => {
    const tried: Environment[] = [];
    return withAppleEnvironment(apple, known, async (environment) => {
      tried.push(environment);
      throw new APIException(statuses[tried.length - 1]);
    }).catch((caught: unknown) => ({
      tried,
      code: (caught as ConvexError<{ code: string }>).data.code,
    }));
  };

  it("answers NOT_FOUND only when every environment it tried has none", async () => {
    await expect(appleError(undefined, [404, 404])).resolves.toEqual({
      tried: [Environment.PRODUCTION, Environment.SANDBOX],
      code: "NOT_FOUND",
    });
    await expect(appleError("Sandbox", [404])).resolves.toEqual({
      tried: [Environment.SANDBOX],
      code: "NOT_FOUND",
    });
    await expect(appleError(undefined, [500])).resolves.toEqual({
      tried: [Environment.PRODUCTION],
      code: "STORE_REQUEST_FAILED",
    });
  });
});

describe("resyncFromStore", () => {
  it("draws on its own bucket, not the one entitlement reads use", async () => {
    const limited = new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many store re-syncs",
      retryAfterSec: 1,
    });
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({ _id: "projects_1" })
      .mockResolvedValueOnce({ kind: "subscription", store: "apple" });
    const runMutation = vi.fn().mockRejectedValue(limited);

    await expect(
      testableFunction(resyncFromStore)._handler(
        { runQuery, runMutation },
        { projectId: PROJECT, subscriptionId: "subscriptions_1" },
      ),
    ).rejects.toBe(limited);
    const [reference, args] = runMutation.mock.calls[0];
    expect(getFunctionName(reference)).toBe(
      "purchases/verificationAdmission:consume",
    );
    expect(args).toEqual({ projectId: "projects_1", bucket: "storeResync" });
  });
});

describe("resyncDisputedSubscription", () => {
  const disputed = testableFunction(resyncDisputedSubscription)._handler;
  const args = {
    projectId: PROJECT,
    subscriptionId: "subscriptions_1" as Id<"subscriptions">,
  };

  it("draws on the re-sync bucket and gives up quietly when it is empty", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce({ _id: "projects_1" })
      .mockResolvedValueOnce({ kind: "subscription", store: "apple" });
    const runMutation = vi.fn().mockRejectedValue(
      new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many store re-syncs",
        retryAfterSec: 1,
      }),
    );

    await expect(disputed({ runQuery, runMutation }, args)).resolves.toBe(null);
    expect(getFunctionName(runQuery.mock.calls[1][0])).toBe(
      "subscriptions/resync:getResyncTarget",
    );
    expect(runQuery.mock.calls[1][1]).toEqual({
      projectId: "projects_1",
      subscriptionId: "subscriptions_1",
    });
    expect(runMutation.mock.calls[0][1]).toEqual({
      projectId: "projects_1",
      bucket: "storeResync",
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("does nothing for a project being deleted", async () => {
    const runQuery = vi.fn().mockResolvedValueOnce(null);
    const runMutation = vi.fn();
    await expect(disputed({ runQuery, runMutation }, args)).resolves.toBe(null);
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runMutation).not.toHaveBeenCalled();
  });
});
