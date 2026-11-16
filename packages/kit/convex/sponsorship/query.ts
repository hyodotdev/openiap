import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { query } from "../_generated/server";
import { assertCliScope } from "../cli/scope";
import { getLink } from "./links";

/** The organization's GitHub sponsorship, for its members; null without a link. */
export const getSponsorshipLink = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();
    if (!membership) return null;
    const link = await getLink(ctx, args.organizationId);
    return (
      link && {
        login: link.login,
        monthlyUsd: link.monthlyUsd,
        isOneTime: link.isOneTime,
      }
    );
  },
});
