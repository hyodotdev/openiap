import { query } from "../_generated/server";
import { v } from "convex/values";

import {
  resolveProjectByApiKeyFromDb,
  resolveProjectByIdForCurrentUserFromDb,
} from "./helpers";
import { getGooglePlayFileByProjectFromDb } from "../files/internal";

// Public query — surfaces which platforms a project has configured so
// the dashboard, the SDK, and the MCP server can return a precise
// "X not configured" error instead of a silent empty response.
//
// Auth via apiKey (same model as the rest of the v1 surface). Returns
// `found: false` when the key is unknown so the dashboard can render
// "log in to a different project" without leaking which keys exist.

const platformShape = v.object({
  configured: v.boolean(),
  missing: v.array(v.string()),
});

export const getSetupStatus = query({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.object({
    found: v.boolean(),
    projectId: v.union(v.id("projects"), v.null()),
    ios: platformShape,
    android: platformShape,
    horizon: platformShape,
    amazon: platformShape,
    appleP8Uploaded: v.boolean(),
    googleServiceAccountUploaded: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const resolved = args.projectId
      ? await resolveProjectByIdForCurrentUserFromDb(ctx, args.projectId)
      : args.apiKey
        ? await resolveProjectByApiKeyFromDb(ctx, args.apiKey, "admin")
        : null;
    const project = resolved?.project ?? null;

    if (!project) {
      const empty = { configured: false, missing: ["project not found"] };
      return {
        found: false,
        projectId: null,
        ios: empty,
        android: empty,
        horizon: empty,
        amazon: empty,
        appleP8Uploaded: false,
        googleServiceAccountUploaded: false,
      };
    }

    // Apple has two accepted key purposes, while Google resolves one active
    // credential through the project's revocable pointer.
    const projectFiles = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const googleServiceAccountUploaded = Boolean(
      await getGooglePlayFileByProjectFromDb(ctx, project),
    );

    const iosMissing: string[] = [];
    if (!project.iosBundleId) iosMissing.push("iosBundleId");
    if (!project.iosAppAppleId) iosMissing.push("iosAppAppleId");
    if (!project.iosAppStoreIssuerId) iosMissing.push("iosAppStoreIssuerId");
    if (!project.iosAppStoreKeyId) iosMissing.push("iosAppStoreKeyId");

    const androidMissing: string[] = [];
    if (!project.androidPackageName) androidMissing.push("androidPackageName");
    if (!googleServiceAccountUploaded) {
      androidMissing.push("googleServiceAccount");
    }

    const horizonMissing: string[] = [];
    if (!project.horizonEnabled) horizonMissing.push("horizonEnabled");
    if (!project.horizonAppId) horizonMissing.push("horizonAppId");
    if (!project.horizonAppSecret) horizonMissing.push("horizonAppSecret");

    const amazonConfigured =
      (typeof project.amazonSharedSecret === "string" &&
        project.amazonSharedSecret.trim().length > 0) ||
      project.amazonSandboxEnabled === true;
    const amazonMissing: string[] = [];
    if (!amazonConfigured) {
      amazonMissing.push("amazonSharedSecret");
    }

    return {
      found: true,
      projectId: project._id,
      ios: {
        configured: iosMissing.length === 0,
        missing: iosMissing,
      },
      android: {
        configured: androidMissing.length === 0,
        missing: androidMissing,
      },
      horizon: {
        configured: horizonMissing.length === 0,
        missing: horizonMissing,
      },
      amazon: {
        configured: amazonConfigured,
        missing: amazonMissing,
      },
      // The webhook receivers ALSO need the .p8 file uploaded to the project.
      appleP8Uploaded: projectFiles.some(
        (f) =>
          f.purpose === "apple_p8_key" || f.purpose === "apple_p8_asc_api_key",
      ),
      googleServiceAccountUploaded,
    };
  },
});
