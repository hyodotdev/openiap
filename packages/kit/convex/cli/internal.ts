import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import { sha256Hex } from "../utils/sha256";

export const cliLimiter = new RateLimiter(components.rateLimiter, {
  start: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  approve: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  poll: { kind: "token bucket", rate: 12, period: MINUTE, capacity: 2 },
});

export const currentSession = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) return null;
    const grant = await ctx.db
      .query("cliSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
      .unique();
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    return grant &&
      grant.userId === userId &&
      session?.userId === userId &&
      (await ctx.db.get(userId))
      ? grant
      : null;
  },
});

export const sessionClaims = internalQuery({
  args: { sessionId: v.id("authSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db
      .query("cliSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
      .unique();
    return session
      ? { revoked: session.revoked, expiresAt: session.expiresAt }
      : null;
  },
});

export const consume = internalMutation({
  args: { deviceCode: v.optional(v.string()), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.token) {
      const hash = await sha256Hex(args.token);
      const grant = await ctx.db
        .query("cliSessions")
        .withIndex("by_token_hash", (q) => q.eq("tokenHash", hash))
        .unique();
      if (
        !grant ||
        grant.revoked ||
        grant.expiresAt <= Date.now() ||
        !(await ctx.db.get(grant.userId))
      )
        return null;
      const session = await ctx.db.get(grant.sessionId);
      if (
        !session ||
        session.userId !== grant.userId ||
        session.expirationTime <= Date.now()
      )
        return null;
      return { userId: grant.userId, sessionId: grant.sessionId };
    }
    if (!args.deviceCode || args.deviceCode.length > 128) return null;
    const hash = await sha256Hex(args.deviceCode);
    await cliLimiter.limit(ctx, "poll", { key: hash, throws: true });
    const device = await ctx.db
      .query("cliDevices")
      .withIndex("by_device_hash", (q) => q.eq("deviceHash", hash))
      .unique();
    if (!device || device.expiresAt <= Date.now())
      throw new ConvexError({
        code: "EXPIRED_TOKEN",
        message: "Login code expired.",
      });
    if (device.denied)
      throw new ConvexError({
        code: "ACCESS_DENIED",
        message: "Login was denied.",
      });
    if (!device.userId) return null;
    if (!(await ctx.db.get(device.userId))) return null;
    const expiresAt = Date.now() + 30 * 24 * 60 * MINUTE;
    const sessionId = await ctx.db.insert("authSessions", {
      userId: device.userId,
      expirationTime: expiresAt,
    });
    const grantId = await ctx.db.insert("cliSessions", {
      userId: device.userId,
      sessionId,
      name: device.name,
      scope: device.scope,
      expiresAt,
      revoked: false,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAt(expiresAt, internal.cli.internal.expireSession, {
      grantId,
    });
    await ctx.db.delete(device._id);
    return { userId: device.userId, sessionId };
  },
});

export const expireDevice = internalMutation({
  args: { deviceId: v.id("cliDevices") },
  handler: async (ctx, { deviceId }) => {
    if (await ctx.db.get(deviceId)) await ctx.db.delete(deviceId);
  },
});

export const expireSession = internalMutation({
  args: { grantId: v.id("cliSessions") },
  handler: async (ctx, { grantId }) => {
    const grant = await ctx.db.get(grantId);
    if (!grant) return;
    await ctx.db.patch(grantId, { revoked: true });
    if (await ctx.db.get(grant.sessionId)) await ctx.db.delete(grant.sessionId);
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", grant.sessionId))
      .take(100);
    for (const token of tokens) await ctx.db.delete(token._id);
    if (tokens.length === 100)
      await ctx.scheduler.runAfter(0, internal.cli.internal.expireSession, {
        grantId,
      });
  },
});
