import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

export const oauthLimiter = new RateLimiter(components.rateLimiter, {
  approve: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
});

export const expireCode = internalMutation({
  args: { codeId: v.id("oauthCodes") },
  handler: async (ctx, { codeId }) => {
    if (await ctx.db.get(codeId)) await ctx.db.delete(codeId);
  },
});

/** Deletes a grant whose refresh token lapsed; a refreshed one is checked again later. */
export const expireGrant = internalMutation({
  args: { grantId: v.id("oauthGrants") },
  handler: async (ctx, { grantId }) => {
    const grant = await ctx.db.get(grantId);
    if (!grant) return;
    if (grant.refreshExpiresAt <= Date.now()) await ctx.db.delete(grantId);
    else
      await ctx.scheduler.runAt(
        grant.refreshExpiresAt,
        internal.oauth.internal.expireGrant,
        { grantId },
      );
  },
});
