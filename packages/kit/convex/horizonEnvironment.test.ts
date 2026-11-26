// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";
import { HarmonizedPurchaseState } from "./purchases/purchaseState";

const modules = import.meta.glob("./**/*.ts");

it("stores, keeps and removes a Horizon environment through the real mutation", async () => {
  const t = convexTest({ schema, modules });
  const projectId = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Org",
      slug: "org",
      createdAt: 0,
      updatedAt: 0,
    });
    return ctx.db.insert("projects", {
      organizationId,
      name: "Project",
      slug: "project",
      apiKey: "key",
      createdAt: 0,
      updatedAt: 0,
    });
  });
  const verify = (environment?: "Sandbox" | null) =>
    t.mutation(internal.purchases.internal.saveReceiptInternal, {
      projectId,
      store: "horizon",
      applicationId: "1234567890123456",
      remoteId: "meta-user:premium",
      requestData: { store: "horizon", userId: "meta-user", sku: "premium" },
      remoteResponse: JSON.stringify({ success: true, sku: "premium" }),
      state: HarmonizedPurchaseState.ENTITLED,
      isValid: true,
      ...(environment === undefined ? {} : { environment }),
    });
  const row = async () =>
    (await t.run((ctx) => ctx.db.query("purchases").collect()))[0];

  await verify("Sandbox");
  expect((await row()).environment).toBe("Sandbox");
  await verify();
  expect((await row()).environment).toBe("Sandbox");
  await verify(null);
  expect(await row()).not.toHaveProperty("environment");
  await verify();
  expect(await row()).not.toHaveProperty("environment");
  expect(
    await t.run((ctx) => ctx.db.query("purchases").collect()),
  ).toHaveLength(1);
});
