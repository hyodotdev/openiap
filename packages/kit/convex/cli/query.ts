import { getAuthUserId, getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { assertCliScope } from "./scope";
import { sha256Hex } from "../utils/sha256";
import { paginationOptsValidator } from "convex/server";

export const device = query({
  args: { userCode: v.string() },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) return null;
    const hash = await sha256Hex(
      args.userCode.toUpperCase().replace(/[-\s]/g, ""),
    );
    const device = await ctx.db
      .query("cliDevices")
      .withIndex("by_user_code_hash", (q) => q.eq("userCodeHash", hash))
      .unique();
    return device
      ? {
          name: device.name,
          scope: device.scope,
          expiresAt: device.expiresAt,
          used: !!device.userId || !!device.denied,
        }
      : null;
  },
});

export const session = query({
  args: {},
  handler: async (ctx) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId)
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Run openiap kit login.",
      });
    const user = await ctx.db.get(userId);
    const identity = await ctx.auth.getUserIdentity();
    const sessionId = await getAuthSessionId(ctx);
    const grant = sessionId
      ? await ctx.db
          .query("cliSessions")
          .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
          .unique()
      : null;
    return {
      user: user ? { id: user._id, name: user.name, email: user.email } : null,
      cli: identity?.iapkitCli === true,
      expiresAt: grant?.expiresAt,
    };
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "admin");
    const userId = await getAuthUserId(ctx);
    if (!userId)
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in first.",
      });
    const grants = await ctx.db
      .query("cliSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(100, args.paginationOpts.numItems),
      });
    const sessions = grants.page.map(
      ({ _id, name, scope, expiresAt, revoked, createdAt, tokenHash }) => ({
        id: _id,
        name,
        scope,
        expiresAt,
        revoked,
        createdAt,
        automation: tokenHash !== undefined,
      }),
    );
    return {
      sessions,
      hasMore: !grants.isDone,
      nextCursor: grants.isDone ? null : grants.continueCursor,
    };
  },
});
