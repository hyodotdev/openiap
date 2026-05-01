import { query } from "../_generated/server";
import { v } from "convex/values";

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
  args: { apiKey: v.string() },
  returns: v.object({
    found: v.boolean(),
    projectId: v.union(v.id("projects"), v.null()),
    ios: platformShape,
    android: platformShape,
    horizon: platformShape,
    appleP8Uploaded: v.boolean(),
    googleServiceAccountUploaded: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!project) {
      const empty = { configured: false, missing: ["project not found"] };
      return {
        found: false,
        projectId: null,
        ios: empty,
        android: empty,
        horizon: empty,
        appleP8Uploaded: false,
        googleServiceAccountUploaded: false,
      };
    }

    // We don't run an action from a query, so file-presence checks are
    // a separate `internal.files.internal.*` lookup the dashboard can
    // call. From here we report only field-level configuration.
    const iosMissing: string[] = [];
    if (!project.iosBundleId) iosMissing.push("iosBundleId");
    if (!project.iosAppAppleId) iosMissing.push("iosAppAppleId");
    if (!project.iosAppStoreIssuerId) iosMissing.push("iosAppStoreIssuerId");
    if (!project.iosAppStoreKeyId) iosMissing.push("iosAppStoreKeyId");

    const androidMissing: string[] = [];
    if (!project.androidPackageName) androidMissing.push("androidPackageName");

    const horizonMissing: string[] = [];
    if (!project.horizonEnabled) horizonMissing.push("horizonEnabled");
    if (!project.horizonAppId) horizonMissing.push("horizonAppId");
    if (!project.horizonAppSecret) horizonMissing.push("horizonAppSecret");

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
      // The webhook receivers ALSO need the .p8 / service-account JSON
      // file uploaded to the project; that's stored separately. The
      // dashboard's setup card surfaces the file-upload state from a
      // companion `files` query.
      appleP8Uploaded: false,
      googleServiceAccountUploaded: false,
    };
  },
});
