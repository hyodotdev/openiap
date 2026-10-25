import { describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";

const transport = vi.hoisted(() => ({ publisher: vi.fn() }));
vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: class {} },
    androidpublisher: transport.publisher,
  },
}));
import { runProductSyncAndroid } from "./play";

describe("Google Play pull preview", () => {
  it.each([true, false])(
    "reads modern products, legacy products and subscriptions with dryRun=%s",
    async (dryRun) => {
      const listModern = vi.fn().mockResolvedValue({
        data: {
          oneTimeProducts: [
            { productId: "modern", purchaseOptions: [{ state: "ACTIVE" }] },
          ],
        },
      });
      const listLegacy = vi.fn().mockResolvedValue({
        data: {
          inappproduct: [{ sku: "legacy", purchaseType: "managedUser" }],
        },
      });
      const listSubscriptions = vi.fn().mockResolvedValue({
        data: { subscriptions: [{ productId: "subscription", basePlans: [] }] },
      });
      transport.publisher.mockReturnValue({
        inappproducts: { list: listLegacy },
        monetization: {
          onetimeproducts: { list: listModern },
          subscriptions: {
            list: listSubscriptions,
            basePlans: {
              offers: { list: vi.fn().mockResolvedValue({ data: {} }) },
            },
          },
        },
      });
      const runMutation = vi.fn().mockResolvedValue(null);
      const ctx = {
        runQuery: vi.fn(async (reference: FunctionReference<"query">) => {
          switch (getFunctionName(reference)) {
            case "products/jobs:getJobForWorker":
              return {
                status: "queued",
                projectId: "project",
                direction: "pull",
                dryRun,
              };
            case "products/jobs:isCancelRequested":
              return false;
            case "projects/internal:getProjectById":
              return { _id: "project", androidPackageName: "dev.cli.e2e" };
            case "files/internal:getGooglePlayFileByProjectInternal":
              return { _id: "file" };
            case "products/sync:listExistingProductTypes":
              return [];
            default:
              throw new Error("Unexpected query in pull test");
          }
        }),
        runAction: vi.fn().mockResolvedValue({ content: "{}" }),
        runMutation,
      };
      await testableFunction(runProductSyncAndroid)._handler(ctx, {
        jobId: "job" as Id<"productSyncJobs">,
      });
      expect(listModern).toHaveBeenCalledOnce();
      expect(listLegacy).toHaveBeenCalledOnce();
      expect(listSubscriptions).toHaveBeenCalledOnce();
      const writes = runMutation.mock.calls.filter(
        ([reference]) =>
          getFunctionName(reference) === "products/sync:upsertFromStore",
      );
      expect(writes.map(([, args]) => args.productId)).toEqual(
        dryRun ? [] : ["modern", "legacy", "subscription"],
      );
      expect(runMutation.mock.calls).toContainEqual([
        expect.anything(),
        expect.objectContaining({ pulled: 3, failures: [] }),
      ]);
    },
  );
});
