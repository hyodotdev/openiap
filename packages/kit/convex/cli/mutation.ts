import { getAuthUserId, getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { randomHex } from "../utils/helpers";
import { sha256Hex } from "../utils/sha256";
import { cliLimiter } from "./internal";
import { assertCliScope } from "./scope";
import { assertCliStartSource, cliStartSourceValidator } from "./source";

const scope = v.union(
  v.literal("read"),
  v.literal("write"),
  v.literal("admin"),
);

export const start = mutation({
  args: {
    name: v.string(),
    scope,
    sourceAuth: v.optional(cliStartSourceValidator),
  },
  handler: async (ctx, args) => {
    const sourceKey = await assertCliStartSource(args);
    await cliLimiter.limit(ctx, "start", { key: sourceKey, throws: true });
    if (!args.name.trim() || args.name.length > 100)
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Name must be 1–100 characters.",
      });
    const deviceCode = randomHex(32);
    const userCode = randomHex(5).toUpperCase();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const deviceId = await ctx.db.insert("cliDevices", {
      deviceHash: await sha256Hex(deviceCode),
      userCodeHash: await sha256Hex(userCode),
      name: args.name,
      scope: args.scope,
      expiresAt,
    });
    await ctx.scheduler.runAt(expiresAt, internal.cli.internal.expireDevice, {
      deviceId,
    });
    return { deviceCode, userCode, expiresAt, interval: 5 };
  },
});

export const approve = mutation({
  args: { userCode: v.string(), allow: v.boolean() },
  handler: async (ctx, args) => {
    if ((await ctx.auth.getUserIdentity())?.iapkitCli === true)
      throw new ConvexError({
        code: "INSUFFICIENT_SCOPE",
        message: "Approve CLI logins from an interactive browser session.",
      });
    const userId = await getAuthUserId(ctx);
    if (!userId)
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in to IAPKit first.",
      });
    await cliLimiter.limit(ctx, "approve", { key: userId, throws: true });
    const hash = await sha256Hex(
      args.userCode.toUpperCase().replace(/[-\s]/g, ""),
    );
    const device = await ctx.db
      .query("cliDevices")
      .withIndex("by_user_code_hash", (q) => q.eq("userCodeHash", hash))
      .unique();
    if (
      !device ||
      device.expiresAt <= Date.now() ||
      device.userId ||
      device.denied
    )
      return {
        approved: false,
        error: "This login code is invalid or expired.",
      };
    await ctx.db.patch(device._id, args.allow ? { userId } : { denied: true });
    return { approved: args.allow, error: null };
  },
});

export const createToken = mutation({
  args: { name: v.string(), scope, expiresInDays: v.number() },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "admin");
    const userId = await getAuthUserId(ctx);
    if (!userId)
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in first.",
      });
    if (
      !args.name.trim() ||
      args.name.length > 100 ||
      !Number.isInteger(args.expiresInDays) ||
      args.expiresInDays < 1 ||
      args.expiresInDays > 90
    )
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Use a name of 1–100 characters and an expiry of 1–90 days.",
      });
    const token = `iapkit_cli_${randomHex(32)}`;
    const expiresAt = Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000;
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: expiresAt,
    });
    const id = await ctx.db.insert("cliSessions", {
      userId,
      sessionId,
      name: args.name,
      scope: args.scope,
      expiresAt,
      revoked: false,
      tokenHash: await sha256Hex(token),
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAt(expiresAt, internal.cli.internal.expireSession, {
      grantId: id,
    });
    return { id, name: args.name, scope: args.scope, token, expiresAt };
  },
});

export const revoke = mutation({
  args: { id: v.id("cliSessions") },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "admin");
    const userId = await getAuthUserId(ctx);
    const grant = await ctx.db.get(args.id);
    if (!userId || grant?.userId !== userId)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "CLI session not found.",
      });
    await ctx.runMutation(internal.cli.internal.expireSession, {
      grantId: args.id,
    });
    return { revoked: true };
  },
});

export const logout = mutation({
  args: {},
  handler: async (ctx) => {
    await assertCliScope(ctx, "read");
    const sessionId = await getAuthSessionId(ctx);
    const grant = sessionId
      ? await ctx.db
          .query("cliSessions")
          .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
          .unique()
      : null;
    if (!grant)
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "No CLI session is signed in.",
      });
    await ctx.runMutation(internal.cli.internal.expireSession, {
      grantId: grant._id,
    });
    return { loggedOut: true };
  },
});
