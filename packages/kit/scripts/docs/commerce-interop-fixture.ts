import {
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { apiKeyStorageFields } from "./apiKeys/helpers";

export const seed = internalMutation({
  args: {
    secret: v.string(),
    key: v.string(),
    publishable: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {});
    const organizationId = await ctx.db.insert("organizations", {
      name: "Local interop",
      slug: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
    const projectId = await ctx.db.insert("projects", {
      organizationId,
      name: "Local interop",
      slug: crypto.randomUUID(),
      apiKey: "disabled",
      legacyApiKeyFallbackDisabledAt: now,
      androidPackageName: "dev.openiap.interop",
      iosBundleId: "dev.openiap.interop",
      iosAppAppleId: 123456789,
      iosAppStoreIssuerId: "local-issuer",
      iosAppStoreKeyId: "local-key",
      horizonEnabled: true,
      horizonAppId: "1234567890",
      horizonAppSecret: "local-fixture-secret",
      amazonSandboxEnabled: true,
      amazonSharedSecret: "local-fixture-secret",
      createdAt: now,
      updatedAt: now,
    });
    for (const [key, keyType] of [
      [args.key, "secret"],
      [args.publishable, "publishable"],
    ] as const)
      await ctx.db.insert("apiKeys", {
        organizationId,
        projectId,
        ...(await apiKeyStorageFields(key, keyType)),
        name: "Local fixture",
        keyType,
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    const fileId = await ctx.db.insert("files", {
      organizationId,
      projectId,
      uploadedBy: userId,
      storageId: args.storageId,
      fileName: "local-fixture.json",
      fileType: "application/json",
      fileSize: 0,
      purpose: "android_service_account",
      isInternal: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(projectId, { googlePlayServiceAccountFileId: fileId });
    await ctx.db.insert("outboundDestinations", {
      projectId,
      url: "https://receiver.example.com/commerce",
      secret: args.secret,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return { projectId };
  },
});
export const setup = internalAction({
  args: { secret: v.string(), key: v.string(), publishable: v.string() },
  handler: async (ctx, args) => {
    const storageId = await ctx.storage.store(
      new Blob(
        [
          JSON.stringify({
            type: "service_account",
            project_id: "local-fixture",
            private_key:
              "-----BEGIN PRIVATE KEY-----\nfixture only\n-----END PRIVATE KEY-----",
            client_email: "fixture@local-test.iam.gserviceaccount.com",
          }),
        ],
        { type: "application/json" },
      ),
    );
    return ctx.runMutation(internal.interopFixture.seed, {
      ...args,
      storageId,
    });
  },
});
export const inspect = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => ({
    purchases: await ctx.db
      .query("purchases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
    subscriptions: await ctx.db
      .query("subscriptions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
    events: await ctx.db
      .query("commerceEvents")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
    jobs: await ctx.db
      .query("subscriptionUserErasureJobs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
    deliveries: await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
  }),
});
